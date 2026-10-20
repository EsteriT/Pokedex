const assert = require("node:assert/strict");
module.exports = async function (db, as, document) {
  const { normalize } = require("./catalogue-import.cjs");
  const card = normalize(
    {
      id: "base1-1",
      localId: "1",
      name: "Alakazam",
      category: "Pokemon",
      types: ["Psychic"],
      rarity: "Rare",
      set: { id: "base1" },
      variants: { holo: true },
      image: "https://assets.tcgdex.net/en/base/base1/1",
    },
    { id: "base1", name: "Base Set" },
  );
  await db.query("insert into binder_private.catalogue_sets values($1,$2)", [
    "base1",
    JSON.stringify({
      id: "base1",
      name: "Base Set",
      count: 1,
      preview: [card],
    }),
  ]);
  await db.query(
    "insert into binder_private.catalogue(card_id,variants,record) values($1,$2,$3)",
    [card.id, JSON.stringify(card.variants), JSON.stringify(card)],
  );
  const search = async (filters = {}, page = 1) =>
    (
      await as(
        null,
        (tx) =>
          tx.query("select public.search_catalogue($1::jsonb,$2) as result", [
            JSON.stringify(filters),
            page,
          ]),
        "anon",
      )
    ).rows[0].result;
  assert.equal((await search({ q: "Alakazam" })).cards[0].id, card.id);
  assert.equal((await search({ q: "#001" })).total, 1);
  assert.equal((await search({ q: "%' or true; --" })).total, 0);
  assert.equal(
    (await search({ set: "base1", type: "Psychic", finish: "holo" })).total,
    1,
  );
  assert.equal((await search({ set: "base1", finish: "reverse" })).total, 0);
  await assert.rejects(search({}, 0), /Invalid catalogue search/);
  await assert.rejects(
    search({ q: "x".repeat(121) }),
    /Invalid catalogue search/,
  );
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.catalogue_cards($1::text[])", [
          Array(101).fill(card.id),
        ]),
      "anon",
    ),
    /at most 100/,
  );
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      as(
        null,
        (tx) => tx.query("select * from binder_private.catalogue"),
        role,
      ),
      /permission denied/,
    );
    await assert.rejects(
      as(
        null,
        (tx) => tx.query("update binder_private.catalogue set variants='{}'"),
        role,
      ),
      /permission denied/,
    );
  }
  const doc = document();
  doc.pages[0].regions[0].content = {
    id: "catalogue-content",
    cardId: card.id,
    variant: "holo",
  };
  assert.equal(
    (
      await db.query(
        "select binder_private.valid_document($1::jsonb) as valid",
        [JSON.stringify(doc)],
      )
    ).rows[0].valid,
    true,
  );
  doc.pages[0].regions[0].content.variant = "reverse";
  assert.equal(
    (
      await db.query(
        "select binder_private.valid_document($1::jsonb) as valid",
        [JSON.stringify(doc)],
      )
    ).rows[0].valid,
    false,
  );
  // Reimporting provider corrections must preserve finishes used by saved cards,
  // including cards loaded through set previews rather than explicit lookups.
  await db.query("update binder_private.catalogue set variants=jsonb_set(variants,'{normal}','true') where card_id=$1",[card.id]);
  const {sql,setIds}=require('./catalogue-import.cjs');
  await db.exec(sql({provider:'tcgdex',language:'en',cards:[card],sets:setIds.map(id=>({id,name:id,count:1,preview:id==='base1'?[card]:[]}))}));
  const info=(await as(null,tx=>tx.query('select public.catalogue_info() as result'), 'anon')).rows[0].result;
  assert.equal(info.sets.find(s=>s.id==='base1').preview[0].variants.normal,true);
  console.log(
    "PASS: anonymous catalogue reads, direct access/write denial, bounded search and authoritative finish validation.",
  );
};
