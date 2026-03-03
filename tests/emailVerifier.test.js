const verifyEmail = require("../services/emailVerifer");
const getDidYouMean = require("../utils/didYouMean");
jest.mock("smtp-connection");
const SMTPConnection = require("smtp-connection");

describe("Syntax Validation Tests", () => {

  test("Valid email passes", async () => {
    const res = await verifyEmail("test@gmail.com");
    expect(res.email).toBe("test@gmail.com");
  });

  test("Missing @ rejected", async () => {
    const res = await verifyEmail("testgmail.com");
    expect(res.subresult).toBe("invalid_format");
  });

  test("Double @ rejected", async () => {
    const res = await verifyEmail("a@@gmail.com");
    expect(res.subresult).toBe("invalid_format");
  });

  test("Empty string handled", async () => {
    const res = await verifyEmail("");
    expect(res.subresult).toBe("invalid_format");
  });

  test("Null handled", async () => {
    const res = await verifyEmail(null);
    expect(res.subresult).toBe("invalid_format");
  });

});

describe("Did You Mean Tests", () => {

  test("gmial.com typo", () => {
    expect(getDidYouMean("user@gmial.com"))
      .toBe("user@gmail.com");
  });

  test("hotmial.com typo", () => {
    expect(getDidYouMean("user@hotmial.com"))
      .toBe("user@hotmail.com");
  });

  test("Correct domain returns null", () => {
    expect(getDidYouMean("user@gmail.com"))
      .toBeNull();
  });

});

describe("Edge Cases", () => {

  test("Very long email handled", async () => {
    const longEmail =
      "a".repeat(100) + "@gmail.com";

    const res = await verifyEmail(longEmail);
    expect(res.email).toBe(longEmail);
  });

});

describe("Additional Edge & Error Cases", () => {

  test("Multiple @ symbols rejected", async () => {
    const res = await verifyEmail("a@b@gmail.com");
    expect(res.subresult).toBe("invalid_format");
  });

  test("Undefined handled", async () => {
    const res = await verifyEmail(undefined);
    expect(res.subresult).toBe("invalid_format");
  });

});

describe("SMTP Error Code Tests", () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("550 error → invalid result", async () => {

    SMTPConnection.mockImplementation(() => ({
      connect: cb => cb(null),
      mail: (from, cb) => cb(null),
      rcpt: (to, cb) => cb({ responseCode: 550 }),
      quit: () => {}
    }));

    const res = await verifyEmail("fake@gmail.com");

    expect(res.result).toBe("invalid");
    expect(res.resultcode).toBe(6);
    expect(res.subresult).toBe("mailbox_does_not_exist");
  });


  test("450 error → unknown result", async () => {

    SMTPConnection.mockImplementation(() => ({
      connect: cb => cb(null),
      mail: (from, cb) => cb(null),
      rcpt: (to, cb) => cb({ responseCode: 450 }),
      quit: () => {}
    }));

    const res = await verifyEmail("grey@gmail.com");

    expect(res.result).toBe("unknown");
    expect(res.resultcode).toBe(3);
    expect(res.subresult).toBe("greylisted");
  });


  test("Connection timeout → unknown result", async () => {

    SMTPConnection.mockImplementation(() => ({
      connect: cb => cb(new Error("timeout")),
      quit: () => {}
    }));

    const res = await verifyEmail("timeout@gmail.com");

    expect(res.result).toBe("unknown");
    expect(res.resultcode).toBe(3);
  });


  test("No MX records handled", async () => {

    const dns = require("dns").promises;
    jest.spyOn(dns, "resolveMx").mockResolvedValue([]);

    const res = await verifyEmail("nomx@randomdomain.com");

    expect(res.subresult).toBe("no_mx_records");
  });

});

SMTPConnection.mockImplementation(() => ({
  connect: cb => cb(null),
  mail: (from, cb) => cb(null),
  rcpt: (to, cb) => {
    const error = new Error("Mailbox not found");
    error.responseCode = 550;
    cb(error);
  },
  quit: () => {}
}));

SMTPConnection.mockImplementation(() => ({
  connect: cb => cb(null),
  mail: (from, cb) => cb(null),
  rcpt: (to, cb) => {
    const error = new Error("Greylisted");
    error.responseCode = 450;
    cb(error);
  },
  quit: () => {}
}));
