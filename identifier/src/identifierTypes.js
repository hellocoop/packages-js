// identifierTypes.js -- only used during build
// edit this file to add new identifier types

const identifierTypeDescriptions = {
  // Customer exposed
  sub: 'Hellō directed identifier - `sub` in ID token',
  app: 'Hellō application identifier (client_id) - `aud` in ID token',
  // Wallet internal
  usr: 'Hellō internal user identifier',
  jti: 'ID Token jti',
  ses: 'Hellō session identifier',
  dvc: 'Hellō device cookie identifier',
  inv: 'Hellō invitation identifier',
  pky: 'Hellō passkey identifier',
  non: 'Hellō nonce identifier',
  cod: "Hellō authorization code",
  org: "Hellō organization identifier",
  req: "Internal HTTP request identifier",
  // Admin internal
  pub: 'Hellō publisher identifier',
};

const identifierTypesSet = new Set(Object.keys(identifierTypeDescriptions));

if (Object.keys(identifierTypeDescriptions).length !== identifierTypesSet.size) {
  throw new Error("Mismatch between identifierTypeDescriptions keys and identifierTypesSet size.");
}

export { identifierTypesSet, identifierTypeDescriptions };