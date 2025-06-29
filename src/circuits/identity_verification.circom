pragma circom 2.2.2;

include "../../node_modules/circomlib/circuits/comparators.circom";

template IdentityVerification(nameLength, surnameLength, ageRequirement) {

    // Private inputs
    signal input birthDate;                         // Format yyyymmdd

    // Public inputs
    signal input name[nameLength];
    signal input surname[surnameLength];
    signal input currentDate;                       // Format yyyymmdd
    signal input nonce;

    // Output
    signal output isMajor;

    // Calculate age
    signal age <== currentDate - birthDate;
 
    // Check if person is major
    component majorCheck = GreaterEqThan(22);
    majorCheck.in[0] <== age;
    majorCheck.in[1] <== ageRequirement * 10000;    // Assuming date format is yyyymmdd
    isMajor <== majorCheck.out;
}
