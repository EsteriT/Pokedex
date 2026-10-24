const assert = require("node:assert/strict");
module.exports = async function (db, as, document) {
  const { normalize } = require("./catalogue-import.cjs");
  const card = normalize(
    {
      id: "base1-1",
      localId: "1",
      name: "Alakazam",
      hp: 80,
      illustrator: "Test Artist",
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
  assert.equal((await search({set:['base1','missing'],type:['Fire','Psychic'],rarity:['Rare','Uncommon']})).total,1);
  assert.equal((await search({type:['Water','Fire']})).total,0);
  assert.equal((await search({category:'Pokemon',illustrator:'artist',hpMin:80,hpMax:80})).total,1);
  assert.equal((await search({q:'Test Artist'})).total,1);
  assert.equal((await search({category:['Pokemon','Trainer'],finish:['holo','reverse'],illustrator:['Test Artist','Other']})).total,1);
  for (const [q,qScope,total] of [['Alakazam','name',1],['Alakazam','illustrator',0],['Test Artist','illustrator',1],['Test Artist','name',0],['Base Set','set',1],['Base Set','name',0],['#001','number',1]])
    assert.equal((await search({q,qScope})).total,total);
  await db.query("update binder_private.catalogue set record=jsonb_set(record,'{pokemonTypes}',$1::jsonb) where card_id=$2",[JSON.stringify(['Dragon','Fighting']),card.id]);
  assert.equal((await search({type:['Dragon','Fighting'],typeMatch:'all'})).total,1);
  assert.equal((await search({type:['Dragon','Water'],typeMatch:'all'})).total,0);
  assert.equal((await search({type:['Dragon','Water'],typeMatch:'any'})).total,1);
  await db.query("update binder_private.catalogue set record=$1::jsonb where card_id=$2",[JSON.stringify(card),card.id]);
  assert.equal((await search({hpMin:81})).total,0);
  for (const filters of [{set:{}},{type:[12]},{finish:['invalid']},{category:[12]},{illustrator:{}},{qScope:'private'},{typeMatch:'invalid'},{rarity:Array(21).fill('Rare')},{hpMin:90,hpMax:80},{hpMin:-1},{hpMax:'abc'}])
    await assert.rejects(search(filters),/Invalid/);
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
  // including the compact directory's finish options.
  await db.query("update binder_private.catalogue set variants=jsonb_set(variants,'{normal}','true') where card_id=$1",[card.id]);
  const {sql,setIds}=require('./catalogue-import.cjs');
  await db.exec(sql({provider:'tcgdex',language:'en',cards:setIds.map(id=>({...card,id:id+'-1',providerId:id+'-1',setId:id,setName:id})),sets:setIds.map(id=>({id,name:id,count:1}))}));
  const info=(await as(null,tx=>tx.query('select public.catalogue_info() as result'), 'anon')).rows[0].result;
  assert.equal(info.sets.find(s=>s.id==='base1').preview.length,0);
  assert(info.finishes.includes('normal'));
  assert.equal((await search({q:card.providerId})).cards[0].variants.normal,true);
  console.log(
    "PASS: anonymous catalogue reads, direct access/write denial, bounded search and authoritative finish validation.",
  );
};
