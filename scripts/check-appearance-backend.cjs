const assert = require("node:assert/strict");

module.exports = async (db, document, validate) => {
  const valid = async doc => (await db.query(
    "select binder_private.valid_document($1::jsonb) as valid", [JSON.stringify(doc)],
  )).rows[0].valid;
  for (const subtitle of ["", "x".repeat(60), "\u{1f600}".repeat(30)]) {
    const doc = document();
    doc.cover = { theme: "classic", subtitle };
    assert.equal(await valid(doc), true);
    assert.doesNotThrow(() => validate(doc));
  }
  for (const subtitle of [null, 42, [], "x".repeat(61), "\u{1f600}".repeat(31)]) {
    const doc = document();
    doc.cover = { theme: "classic", subtitle };
    assert.equal(await valid(doc), false, "Server must reject a subtitle the browser cannot load");
    assert.throws(() => validate(doc));
  }
  for (const location of ["cover", "page"]) {
    for (const style of [
      null, {}, [], { background: "#fff", pockets: "none" },
      { background: "red", pockets: "none" },
      { background: "#123456", pockets: "invalid" },
      { background: "#123456" },
    ]) {
      const doc = document();
      if (location === "cover") doc.cover = { theme: "classic", pageStyle: style };
      else doc.pages[0].pageStyle = style;
      assert.equal(await valid(doc), false, "Invalid appearance must be rejected at either scope");
      assert.throws(() => validate(doc));
    }
    for (const pockets of ["none", "subtle", "defined"]) {
      const doc = document();
      const style = { background: "#Ab12EF", pockets };
      if (location === "cover") doc.cover = { theme: "classic", pageStyle: style };
      else doc.pages[0].pageStyle = style;
      assert.equal(await valid(doc), true);
      assert.doesNotThrow(() => validate(doc));
    }
  }
  const legacy = document();
  const regions = legacy.pages[0].regions;
  regions[0].cells = [[0,0],[0,1],[1,0]];
  legacy.pages[0].regions = [regions[0], regions[3]];
  legacy.unknownLegacyField = "ignored";
  assert.equal(await valid(legacy), true, "Existing connected merges and ignored fields remain readable");
  assert.doesNotThrow(() => validate(legacy));
  console.log("PASS: server/browser subtitle and page-style parity, UTF-16 limits, valid designs and legacy merge compatibility.");
};
