const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const circomlibjs = require('circomlibjs');

const app = express();
const PORT = 3000;

var circuitPath = "src/circuits/";
var file = "identity";

// Configuration multer pour recevoir les fichiers
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('.'));

let circuitReady = false;

// Fonction simple pour exécuter des commandes
function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// Init circuit au démarrage
async function initCircuit() {
  if (circuitReady) return;

  try {
    console.log('Init circuit...');
    await runCmd(`mkdir -p data/${file}`);
    await runCmd(`circom ${circuitPath}/main_${file}.circom --r1cs --wasm --sym -o data/${file}/`);
    await runCmd(`snarkjs groth16 setup data/${file}/main_${file}.r1cs data/ptau/powersOfTau28_hez_final_18.ptau data/${file}/main_${file}_verification.zkey`);
    await runCmd(`snarkjs zkey export verificationkey data/${file}/main_${file}_verification.zkey data/${file}/main_${file}_verification_key.json`);
    circuitReady = true;
    console.log('Circuit prêt !');
  } catch (e) {
    console.error('Erreur init:', e.message);
  }
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/create-witness', async (req, res) => {
  try {
    if (!circuitReady) await initCircuit();

    const poseidon = await circomlibjs.buildPoseidon(); // <- Initialisation ici
      function stringToBigInt(str) {
        return BigInt('0x' + Buffer.from(str, 'utf8').toString('hex'));
      }

    var output = {
      nameHash: poseidon.F.toString(poseidon([stringToBigInt(req.body.name)])),
      surnameHash: poseidon.F.toString(poseidon([stringToBigInt(req.body.surname)])),
      birthDate: req.body.birthDate,
      currentDate: req.body.currentDate,
      nonce: req.body.nonce,
      // commitmentIdentity: poseidon.F.toString(poseidon([output.nameHash, output.surnameHash, output.birthDate, output.currentDate, output.nonce]))
    }

    var witnessData = {
      nameHash: output.nameHash,
      surnameHash: output.surnameHash,
      birthDate: output.birthDate,
      currentDate: output.currentDate,
      nonce: output.nonce,
      commitmentIdentity: poseidon.F.toString(poseidon([output.nameHash, output.surnameHash, output.birthDate, output.currentDate, output.nonce]))

    };

    fs.writeFileSync('data/input.json', JSON.stringify(witnessData));

    var time = (new Date()).toISOString().replace(/[:.]/g, '-');

    await runCmd(`node data/${file}/main_${file}_js/generate_witness.js data/${file}/main_${file}_js/main_${file}.wasm data/input.json data/${file}/witness_${time}.wtns`);
    
    // Sauvegarder aussi les données d'entrée pour référence (optionnel)
    fs.writeFileSync(`data/${file}/input_${time}.json`, JSON.stringify(witnessData, null, 2));

    console.log('Witness créé !');
    res.json({
      success: true,
      output: 'Witness créé avec succès !',
      witnessFile: `data/${file}/witness_${time}.wtns`,
      witnessTime: time
    });

  } catch (e) {
    console.error('Erreur création witness:', e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint pour générer une preuve à partir d'un fichier .wtns uploadé
app.post('/api/generate-proof', upload.single('witnessFile'), async (req, res) => {
  try {
    if (!circuitReady) await initCircuit();

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier witness (.wtns) fourni' });
    }

    var time = (new Date()).toISOString().replace(/[:.]/g, '-');
    
    // Copier le fichier witness uploadé vers le bon répertoire
    const witnessPath = `data/${file}/witness_${time}.wtns`;
    fs.copyFileSync(req.file.path, witnessPath);
    
    // Nettoyer le fichier temporaire d'upload
    fs.unlinkSync(req.file.path);

    // Générer la preuve avec la commande corrigée
    await runCmd(`snarkjs groth16 prove data/${file}/main_${file}_verification.zkey ${witnessPath} data/${file}/proof_${time}.json data/${file}/public_${time}.json`);

    const proof = JSON.parse(fs.readFileSync(`data/${file}/proof_${time}.json`));
    const publicSignals = JSON.parse(fs.readFileSync(`data/${file}/public_${time}.json`));

    console.log('Preuve générée !');
    res.json({
      success: true,
      output: 'Preuve générée avec succès !',
      proof: proof,
      publicSignals: publicSignals,
      proofTime: time
    });

  } catch (e) {
    console.error('Erreur génération preuve:', e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint pour vérifier une preuve avec des JSON fournis
app.post('/api/verify', async (req, res) => {
  try {
    if (!circuitReady) await initCircuit();

    const { proof, publicSignals } = req.body;
    
    if (!proof || !publicSignals) {
      return res.status(400).json({ error: 'Les données proof et publicSignals sont requises' });
    }

    var time = (new Date()).toISOString().replace(/[:.]/g, '-');
    
    // Sauvegarder les JSON fournis
    const proofPath = `data/${file}/proof_${time}.json`;
    const publicPath = `data/${file}/public_${time}.json`;
    
    fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2));
    fs.writeFileSync(publicPath, JSON.stringify(publicSignals, null, 2));
    
    // Vérifier avec la commande corrigée
    const result = await runCmd(`snarkjs groth16 verify data/${file}/main_${file}_verification_key.json ${publicPath} ${proofPath}`);
    const valid = result.includes('OK');

    let publicData = [];
    try {
      publicData = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
    } catch (err) {
      console.error('Erreur de lecture du fichier JSON publicPath :', err);
    }

    const valeur = publicData[0];
    let interpretation;
    switch (valeur) {
      case "0":
        interpretation = "Mineur";
        break;
      case "1":
        interpretation = "Majeur";
        break;
      case "2":
        interpretation = "Ment sur son identité";
        break;
      default:
        interpretation = "Valeur inconnue";
    }
    
    console.log('Vérification effectuée !');
    res.json({ 
      success: true,
      output: valid ? `Validation OK - La preuve est valide ! ${interpretation}` : 'Validation échouée - La preuve n\'est pas valide.',
      isValid: valid,
      verificationResult: result.trim()
    });
    
  } catch (e) {
    console.error('Erreur vérification:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/database', (req, res) => {
  try {
    const db = fs.existsSync('data/db.json') ? JSON.parse(fs.readFileSync('data/db.json')) : [];
    res.json(db);
  } catch (e) {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
  initCircuit();
});
