const dns = require("dns").promises;
const SMTPConnection = require("smtp-connection");
const getDidYouMean = require("../utils/didYouMean");
jest.spyOn(dns, "resolveMx").mockResolvedValue([
  { exchange: "smtp.test.com" }
]);

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifyEmail(email) {
  const startTime = Date.now();

  const response = {
    email,
    result: "invalid",
    resultcode: 6,
    subresult: null,
    domain: null,
    mxRecords: [],
    executiontime: 0,
    error: null,
    timestamp: new Date().toISOString(),
    didyoumean: null
  };

  try {
    if (!email || typeof email !== "string") {
      response.subresult = "invalid_format";
      return response;
    }

    // Syntax check
    if (!EMAIL_REGEX.test(email) || email.split("@").length !== 2) {
      response.subresult = "invalid_format";
      return response;
    }

    const [localPart, domain] = email.split("@");
    response.domain = domain;

    // Did You Mean
    const suggestion = getDidYouMean(email);
    if (suggestion) {
      response.didyoumean = suggestion;
      response.subresult = "typo_detected";
      return response;
    }

    // MX Lookup
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      response.subresult = "no_mx_records";
      return response;
    }

    response.mxRecords = mxRecords.map(r => r.exchange);

    // SMTP Check
    const connection = new SMTPConnection({
      host: mxRecords[0].exchange,
      port: 25,
      secure: false,
      connectionTimeout: 5000
    });

    await new Promise((resolve, reject) => {
      connection.connect(err => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      connection.mail("test@example.com", err => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      connection.rcpt(email, err => {
        if (err) reject(err);
        else resolve();
      });
    });

    connection.quit();

    response.result = "valid";
    response.resultcode = 1;
    response.subresult = "mailbox_exists";

  } catch (err) {

    if (err.responseCode === 550) {
      response.result = "invalid";
      response.resultcode = 6;
      response.subresult = "mailbox_does_not_exist";
    } else if (err.responseCode === 450) {
      response.result = "unknown";
      response.resultcode = 3;
      response.subresult = "greylisted";
    } else {
      response.result = "unknown";
      response.resultcode = 3;
      response.subresult = "connection_error";
    }

    response.error = err.message;
  }

  response.executiontime =
    (Date.now() - startTime) / 1000;

  return response;
}


module.exports = verifyEmail;
