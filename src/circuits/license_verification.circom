pragma circom 2.2.2;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "./identity_verification.circom";

template LicenseVerification(nameLength, surnameLength, ageRequirement) {

    // Private inputs
    signal input licenseType[3];            // Example: 'A', 'D1E'
    signal input licenseExpiration;         // Format yyyymmdd
    signal input birthDate;                 // Format yyyymmdd

    // Public inputs
    signal input name[nameLength];
    signal input surname[surnameLength];
    signal input currentDate;               // Format yyyymmdd
    signal input nonce;

    // Output
    signal output isValidLicense;

    // Identity verification (isMajor)
    signal isMajor;
    component identityVerify = IdentityVerification(nameLength, surnameLength, ageRequirement);
    identityVerify.name <== name;
    identityVerify.surname <== surname;
    identityVerify.birthDate <== birthDate;
    identityVerify.currentDate <== currentDate;
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
