const levenshtein = require("./levenshtein");

const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com"
];

function getDidYouMean(email) {
  if (!email || !email.includes("@")) return null;

  const [local, domain] = email.split("@");

  for (const validDomain of COMMON_DOMAINS) {
    const distance = levenshtein(domain, validDomain);

    if (distance <= 2 && domain !== validDomain) {
      return `${local}@${validDomain}`;
    }
  }

  return null;
}

module.exports = getDidYouMean;
