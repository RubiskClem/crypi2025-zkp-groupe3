pragma circom 2.2.2;

include "./identity_verification.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

template LicenseVerification() {

    // Inputs
    signal input nameHash;                                  // Hash
    signal input surnameHash;                               // Hash
    signal input birthDate;                                 // Format yyyymmdd
    signal input currentDate;                               // Format yyyymmdd
    signal input licenseTypeHash;                           // Hash: 'A', 'D1E'
    signal input licenseExpiration;                         // Format yyyymmdd
    signal input commitmentIdentity;                        // Hash of the identity
    signal input commitmentLicense;                         // Hash of the license
    signal input nonce;                                     // Random number for commitment

    // Output
    signal output isValidLicense;

    // Identity verification (isMajor)
    signal isMajor;
    component identityVerify = IdentityVerification();
    identityVerify.nameHash <== nameHash;
    identityVerify.surnameHash <== surnameHash;
    identityVerify.birthDate <== birthDate;
    identityVerify.currentDate <== currentDate;
    identityVerify.commitmentIdentity <== commitmentIdentity;
    identityVerify.nonce <== nonce;
    isMajor <== identityVerify.isMajor;

    // Check if no license
    component noLicenseCheck = IsZero();
    noLicenseCheck.in <== licenseExpiration;
    signal noLicense;
    noLicense <== noLicenseCheck.out;

    // Check if license is expired
    signal isLicenseValid;
    component licenseCheck = GreaterEqThan(22);
    licenseCheck.in[0] <== licenseExpiration;
    licenseCheck.in[1] <== currentDate;
    isLicenseValid <== licenseCheck.out;

    // Final logic:
    // Default 0: minor
    // 1: license valid
    // 2: license expired

    // temp1 = major * (not noLicense)
    signal notNoLicense;
    notNoLicense <== 1 - noLicense;

    signal hasLicenseAndMajor;
    hasLicenseAndMajor <== isMajor * notNoLicense;

    // Case 1: valid license
    signal case1;
    case1 <== hasLicenseAndMajor * isLicenseValid;

    // Case 2: expired license
    signal case2;
    case2 <== hasLicenseAndMajor * (1 - isLicenseValid);

    // Result:
    // If minor → 0
    // If valid → 1
    // If expired → 2
    isValidLicense <== case1 * 1 + case2 * 2;
}
