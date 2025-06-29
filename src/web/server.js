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

// Route pour générer preuve
app.post('/api/prove', async (req, res) => {
  try {
    if (!circuitReady) await initCircuit();
    
    // Écrire input
    fs.writeFileSync('data/input.json', JSON.stringify(req.body));
    
    var time = (new Date()).toISOString();

    // Générer witness et preuve
    await runCmd(`node data/${file}/main_${file}_js/generate_witness.js data/${file}/main_${file}_js/main_${file}.wasm data/input.json data/${file}/witness_${time}.wtns`);
    await runCmd(`snarkjs groth16 prove data/${file}/${file}_verification.zkey data/${file}/witness_${time}.wtns data/${file}/proof.json data/${file}/public.json`);
    console.log('Preuve générée !aaaaa');
    res.json({ output: 'Preuve générée !' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route pour vérifier
app.post('/api/verify', async (req, res) => {
  try {
    const result = await runCmd('snarkjs groth16 verify data/build/verification_key.json data/build/public.json data/build/proof.json');
    const valid = result.includes('OK');
    res.json({ output: valid ? 'Validation OK' : 'Validation échouée' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Base de données simple
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
