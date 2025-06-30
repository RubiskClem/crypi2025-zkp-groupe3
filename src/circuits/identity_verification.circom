pragma circom 2.2.2;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

template IdentityVerification() {

    // Inputs
    signal input nameHash;                                  // Hash
    signal input surnameHash;                               // Hash
    signal input birthDate;                                 // Format yyyymmdd
    signal input currentDate;                               // Format yyyymmdd
    signal input nonce;                                     // Random number for commitment            
    signal input commitmentIdentity;                        // Hash of the identity

    // Hasher
    component hasher = Poseidon(5);
    hasher.inputs[0] <== nameHash;
    hasher.inputs[1] <== surnameHash;
    hasher.inputs[2] <== birthDate;
    hasher.inputs[3] <== currentDate;
    hasher.inputs[4] <== nonce;

    // Verification of commitmentIdentity
    component isEqual = IsEqual();
    isEqual.in[0] <== hasher.out;
    isEqual.in[1] <== commitmentIdentity;

    // Output
    signal output isMajor;

    // Calculate age
    signal age <== currentDate - birthDate;
 
    // Check if person is major
    component majorCheck = GreaterEqThan(22);
    majorCheck.in[0] <== age;
    majorCheck.in[1] <== 18 * 10000;
    
    // 1 if major, 0 if not, 2 if commitmentIdentity is not equal
    isMajor <==  isEqual.out * majorCheck.out + (1 - isEqual.out) * 2;
}
