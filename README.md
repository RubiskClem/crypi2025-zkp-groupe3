# crypi2025-zkp-groupe3
Project SRS Crypi

# START

circom src/circuits/main_identity.circom --r1cs --wasm --sym -o data/identity/

snarkjs groth16 setup data/identity/main_identity.r1cs data/ptau/powersOfTau28_hez_final_18.ptau data/identity/main_identity_verification.zkey

snarkjs zkey export verificationkey data/identity/main_identity_verification.zkey data/identity/main_identity_verification_key.json


# Create WITNESS index.html

node data/identity/main_identity_js/generate_witness.js data/identity/main_identity_js/main_identity.wasm data/mineur.json data/identity/witness_a.wtns

# Generate d'une preuve

groth16 prove data/identity/main_identity_verification.zkey data/identity/witness_a.wtns data/identity/proof.json data/identity/public.json

# Verrify preuve

snarkjs groth16 verify data/identity/main_identity_verification_key.json data/identity/public.json data/identity/proof.json
