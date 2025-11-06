// src/lib/nodemailer-shim.ts
// Some Next.js/TS setups balk at ESM default imports for nodemailer.
// This shim uses CommonJS require and exports it in a TS-friendly way.

/* eslint-disable @typescript-eslint/no-var-requires */
const nodemailer = require('nodemailer');
export default nodemailer as any;
