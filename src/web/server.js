const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

var circuitPath = "src/circuits/";
var file = "identity";

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
    await runCmd(`snarkjs groth16 setup data/${file}/main_${file}.r1cs data/ptau/powersOfTau28_hez_final_18.ptau data/${file}/${file}_verification.zkey`);
    await runCmd(`snarkjs zkey export verificationkey data/${file}/${file}_verification.zkey data/${file}/verification_key.json`);
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

    fs.writeFileSync('data/input.json', JSON.stringify(req.body));

    var time = (new Date()).toISOString().replace(/[:.]/g, '-');

    await runCmd(`node data/${file}/main_${file}_js/generate_witness.js data/${file}/main_${file}_js/main_${file}.wasm data/input.json data/${file}/witness_${time}.wtns`);
    const witnessData = req.body;
    fs.writeFileSync(`data/${file}/witness_${time}.json`, JSON.stringify(witnessData, null, 2));

    console.log('Witness créé !');
    res.json({
      success: true,
      output: 'Witness créé avec succès !',
      witnessFile: `data/${file}/witness_${time}.json`,
      witnessTime: time
    });

  } catch (e) {
    console.error('Erreur création witness:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate-proof', async (req, res) => {
  try {
    if (!circuitReady) await initCircuit();

    var time = (new Date()).toISOString().replace(/[:.]/g, '-');

    if (req.body && Object.keys(req.body).length > 0) {
      fs.writeFileSync('data/input.json', JSON.stringify(req.body));
      await runCmd(`node data/${file}/main_${file}_js/generate_witness.js data/${file}/main_${file}_js/main_${file}.wasm data/input.json data/${file}/witness_${time}.wtns`);
    } else {
      const witnessFiles = fs.readdirSync(`data/${file}/`).filter(f => f.startsWith('witness_') && f.endsWith('.wtns'));
      if (witnessFiles.length === 0) {
        return res.status(400).json({ error: 'Aucun witness trouvé. Créez d\'abord un witness depuis la page Autorité ou uploadez un fichier witness.' });
      }
      const latestWitness = witnessFiles.sort().reverse()[0];
      time = latestWitness.replace('witness_', '').replace('.wtns', '');
    }

    await runCmd(`snarkjs groth16 prove data/${file}/${file}_verification.zkey data/${file}/witness_${time}.wtns data/${file}/proof_${time}.json data/${file}/public_${time}.json`);

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

app.post('/api/verify', async (req, res) => {
  try {
    const proofFiles = fs.readdirSync(`data/${file}/`).filter(f => f.startsWith('proof_') && f.endsWith('.json'));
    const publicFiles = fs.readdirSync(`data/${file}/`).filter(f => f.startsWith('public_') && f.endsWith('.json'));
    
    if (proofFiles.length === 0) {
      return res.status(400).json({ error: 'Aucune preuve à vérifier. Générez d\'abord une preuve.' });
    }
    
    const latestProof = proofFiles.sort().reverse()[0];
    const latestPublic = publicFiles.sort().reverse()[0];
    
    const result = await runCmd(`snarkjs groth16 verify data/${file}/verification_key.json data/${file}/${latestPublic} data/${file}/${latestProof}`);
    const valid = result.includes('OK');
    
    console.log('Vérification effectuée !');
    res.json({ 
      success: true,
      output: valid ? 'Validation OK - La preuve est valide !' : 'Validation échouée - La preuve n\'est pas valide.',
      isValid: valid
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
