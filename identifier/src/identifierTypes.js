// identifierTypes.js -- only used during build
// edit this file to add new identifier types

const identifierTypeDescriptions = {
    // Customer exposed
    app: 'Hellō application identifier (client_id) - `aud` in ID token',
    cod: 'Hellō authorization code',
    jti: 'ID Token jti',
    non: 'Hellō nonce identifier',
    sub: 'Hellō directed identifier - `sub` in ID token',
    ten: 'Hellō tenant identifier',
    // Wallet internal
    con: 'Hellō connection identifier',
    dvc: 'Hellō device cookie identifier',
    inv: 'Hellō invitation identifier',
    pky: 'Hellō passkey identifier',
    req: 'Internal HTTP request identifier',
    ses: 'Hellō session identifier',
    usr: 'Hellō internal user identifier',
    // Admin internal
    pub: 'Hellō publisher identifier',
    // Deprecated
    org: 'Hellō organization identifier',
}

const identifierTypesSet = new Set(Object.keys(identifierTypeDescriptions))

if (
    Object.keys(identifierTypeDescriptions).length !== identifierTypesSet.size
) {
    throw new Error(
        'Mismatch between identifierTypeDescriptions keys and identifierTypesSet size.',
    )
}

export { identifierTypesSet, identifierTypeDescriptions }
