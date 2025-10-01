// ==========================================
// RICH E-COMMERCE SEED (no APOC required)
// - Users, Categories, Products (with attributes)
// - Tags as nodes + product.tags array
// - Similar edges, Also-bought derived from purchases
// - User behavior with timestamps/qty
// - Neo4j 5 compatible (no subqueries)
// ==========================================

// ---------- Constraints ----------
CREATE CONSTRAINT user_uid IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE;
CREATE CONSTRAINT product_sku IF NOT EXISTS FOR (p:Product) REQUIRE p.sku IS UNIQUE;
CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE;

// ---------- Users ----------
UNWIND [
  {userId:"u_alex",    name:"Alex",    email:"alex@example.com",    location:"Los Angeles, US"},
  {userId:"u_jay",     name:"Jay",     email:"jay@example.com",     location:"Fullerton, US"},
  {userId:"u_poojitha",name:"Poojitha",email:"poojitha@example.com",location:"Irvine, US"},
  {userId:"u_riya",    name:"Riya",    email:"riya@example.com",    location:"San Jose, US"},
  {userId:"u_sam",     name:"Sam",     email:"sam@example.com",     location:"Austin, US"},
  {userId:"u_lena",    name:"Lena",    email:"lena@example.com",    location:"Seattle, US"}
] AS u
MERGE (usr:User {userId:u.userId})
SET usr.name = u.name,
    usr.email = u.email,
    usr.location = u.location;

// ---------- Categories ----------
UNWIND [
  "Hiking","Camping","Electronics","Lighting","Power",
  "Apparel","Climbing","Navigation","Hydration","Cooking","Footwear"
] AS cname
MERGE (:Category {name:cname});

// ---------- Products ----------
UNWIND [
  {sku:"SKU-1001", title:"TrailBuddy Trekking Poles", brand:"TrailBuddy", category:"Hiking", price:39.99, rating:4.4, reviews:1320, stock:42, color:"Black", weight_g:440,  description:"Lightweight aluminum trekking poles with cork grips.", tags:["hiking","lightweight","poles"]},
  {sku:"SKU-1002", title:"Compact Headlamp 200lm",    brand:"BeamLite",   category:"Lighting", price:19.99, rating:4.2, reviews:980,  stock:120, color:"Blue",  weight_g:72,   description:"200 lumen headlamp with 3 modes and tilt.",         tags:["hiking","night","headlamp"]},
  {sku:"SKU-1003", title:"Ultralight Daypack 20L",    brand:"SwiftPack",  category:"Hiking", price:49.00, rating:4.5, reviews:860,  stock:33,  color:"Green", weight_g:420,  description:"20L ripstop daypack with ventilated back panel.",  tags:["hiking","pack","ultralight"]},
  {sku:"SKU-2001", title:"Titan Kettle 750ml",        brand:"CampForge",  category:"Cooking", price:29.00, rating:4.6, reviews:540,  stock:77,  color:"Titanium", weight_g:120, description:"Titanium kettle for backpacking stoves.",         tags:["camping","cookware","titanium"]},
  {sku:"SKU-3001", title:"Solar Power Bank 10k",      brand:"SunGo",      category:"Power", price:24.50, rating:4.1, reviews:1990, stock:210, color:"Black", weight_g:220, description:"10,000 mAh solar charger with dual USB output.",  tags:["electronics","outdoor","solar"]},
  {sku:"SKU-3002", title:"Bluetooth Trail Earbuds",   brand:"TrailTune",  category:"Electronics", price:39.00, rating:4.0, reviews:410, stock:51, color:"Gray", weight_g:18, description:"Sweatproof BT 5.3 earbuds with earhooks.",         tags:["electronics","sweatproof","bluetooth"]},
  {sku:"SKU-1101", title:"Carbon Trek Poles Pro",     brand:"PeakLite",   category:"Hiking", price:89.99, rating:4.7, reviews:640,  stock:20,  color:"Carbon", weight_g:360, description:"Carbon fiber poles with flick-locks, cork grips.", tags:["hiking","lightweight","premium"]},
  {sku:"SKU-2101", title:"2-Person Ultralight Tent",  brand:"SkyShelter", category:"Camping", price:179.00, rating:4.6, reviews:320, stock:15,  color:"Sand",  weight_g:1450, description:"Freestanding double-wall tent, 3-season.",        tags:["camping","shelter","ultralight"]},
  {sku:"SKU-2102", title:"Down Sleeping Bag 20°F",    brand:"NorthLoft",  category:"Camping", price:149.00, rating:4.5, reviews:510, stock:28,  color:"Navy",  weight_g:980,  description:"650-fill down mummy bag rated to 20°F.",         tags:["camping","sleep","down"]},
  {sku:"SKU-1201", title:"Merino Hiking Socks (2-pk)",brand:"FootCloud",  category:"Apparel", price:21.99, rating:4.8, reviews:1650, stock:160, color:"Charcoal", weight_g:110, description:"Breathable merino blend, blister guard zones.",    tags:["hiking","apparel","merino"]},
  {sku:"SKU-3201", title:"Handheld GPS Navigator",    brand:"GeoTrack",   category:"Navigation", price:129.00, rating:4.3, reviews:290, stock:25, color:"Yellow", weight_g:150, description:"Offline topo maps, waypoint manager, IPX7.",      tags:["navigation","gps","outdoor"]},
  {sku:"SKU-2301", title:"Climbing Chalk Bag",        brand:"GripPlus",   category:"Climbing", price:15.50, rating:4.4, reviews:210, stock:60, color:"Teal", weight_g:85, description:"Drawstring chalk bag with brush holder.",          tags:["climbing","chalk","accessory"]},
  {sku:"SKU-1301", title:"Hydration Bladder 2L",      brand:"HydraFlow",  category:"Hydration", price:22.00, rating:4.2, reviews:470, stock:95, color:"Clear", weight_g:170, description:"BPA-free 2L bladder with quick-connect hose.",     tags:["hydration","pack","water"]},
  {sku:"SKU-1401", title:"Trail Running Shoes",       brand:"TerraStep",  category:"Footwear", price:99.00, rating:4.3, reviews:380, stock:40, color:"Red", weight_g:540, description:"Aggressive lugs, rock plate, breathable mesh.",     tags:["footwear","running","trail"]},
  {sku:"SKU-1402", title:"Mid GTX Hiking Boots",      brand:"TerraStep",  category:"Footwear", price:139.00, rating:4.6, reviews:520, stock:22, color:"Brown", weight_g:940, description:"Waterproof mid boots with ankle support.",         tags:["footwear","hiking","waterproof"]},
  {sku:"SKU-1501", title:"Rechargeable Lantern 500lm",brand:"GlowCamp",   category:"Lighting", price:34.00, rating:4.5, reviews:610, stock:72, color:"Olive", weight_g:320, description:"Dimmable 500-lumen lantern with powerbank.",       tags:["camping","lighting","lantern"]},
  {sku:"SKU-1601", title:"Titan Cookset 3-Piece",     brand:"CampForge",  category:"Cooking", price:59.00, rating:4.4, reviews:260, stock:35, color:"Titanium", weight_g:350, description:"Pot/pan/kettle nesting titanium set.",            tags:["camping","cookware","titanium"]},
  {sku:"SKU-3301", title:"Action Cam 4K Mini",        brand:"ViewGo",     category:"Electronics", price:119.00, rating:4.1, reviews:190, stock:18, color:"Black", weight_g:90, description:"4K/30fps, waterproof case, helmet mounts.",       tags:["electronics","camera","outdoor"]}
] AS row
MERGE (cat:Category {name: row.category})
MERGE (p:Product {sku: row.sku})
SET p.title = row.title,
    p.brand = row.brand,
    p.category = row.category,
    p.price = row.price,
    p.rating = row.rating,
    p.reviews = row.reviews,
    p.stock = row.stock,
    p.color = row.color,
    p.weight_g = row.weight_g,
    p.description = row.description,
    p.tags = row.tags
MERGE (p)-[:IN_CATEGORY]->(cat)
WITH p, row.tags AS tags
UNWIND tags AS tg
MERGE (t:Tag {name:tg})
MERGE (p)-[:HAS_TAG]->(t);

// ---------- Hand-curated similarity ----------
MATCH (p1:Product {sku:"SKU-1001"})
MATCH (p3:Product {sku:"SKU-1003"})
MERGE (p1)-[:SIMILAR_TO {score:0.80}]->(p3);

MATCH (p3:Product {sku:"SKU-1003"})
MATCH (p2:Product {sku:"SKU-1002"})
MERGE (p3)-[:SIMILAR_TO {score:0.70}]->(p2);

MATCH (p2:Product {sku:"SKU-1002"})
MATCH (p5:Product {sku:"SKU-3001"})
MERGE (p2)-[:SIMILAR_TO {score:0.60}]->(p5);

MATCH (p5:Product {sku:"SKU-3001"})
MATCH (p6:Product {sku:"SKU-3002"})
MERGE (p5)-[:SIMILAR_TO {score:0.50}]->(p6);

MATCH (p7:Product {sku:"SKU-1101"})
MATCH (p1:Product {sku:"SKU-1001"})
MERGE (p7)-[:SIMILAR_TO {score:0.75}]->(p1);

MATCH (t1:Product {sku:"SKU-2101"})
MATCH (t2:Product {sku:"SKU-2102"})
MERGE (t1)-[:SIMILAR_TO {score:0.72}]->(t2);

MATCH (b1:Product {sku:"SKU-1402"})
MATCH (b2:Product {sku:"SKU-1401"})
MERGE (b1)-[:SIMILAR_TO {score:0.66}]->(b2);

MATCH (k1:Product {sku:"SKU-1601"})
MATCH (k2:Product {sku:"SKU-2001"})
MERGE (k1)-[:SIMILAR_TO {score:0.68}]->(k2);

// ---------- User Interests ----------
MATCH (cH:Category {name:"Hiking"})
MATCH (cC:Category {name:"Camping"})
MATCH (cE:Category {name:"Electronics"})
MATCH (cL:Category {name:"Lighting"})
MATCH (cF:Category {name:"Footwear"})
MATCH (u1:User {userId:"u_alex"})
MATCH (u2:User {userId:"u_jay"})
MATCH (u3:User {userId:"u_poojitha"})
MATCH (u4:User {userId:"u_riya"})
MATCH (u5:User {userId:"u_sam"})
MATCH (u6:User {userId:"u_lena"})
MERGE (u1)-[:LIKES]->(cC)
MERGE (u1)-[:LIKES]->(cE)
MERGE (u2)-[:LIKES]->(cH)
MERGE (u2)-[:LIKES]->(cE)
MERGE (u3)-[:LIKES]->(cH)
MERGE (u3)-[:LIKES]->(cF)
MERGE (u4)-[:LIKES]->(cC)
MERGE (u4)-[:LIKES]->(cL)
MERGE (u5)-[:LIKES]->(cH)
MERGE (u5)-[:LIKES]->(cC)
MERGE (u6)-[:LIKES]->(cE)
MERGE (u6)-[:LIKES]->(cL);

// ---------- User Behavior (no subquery) ----------
UNWIND [
  {userId:"u_jay",     events:[
    {type:"PURCHASED", sku:"SKU-1001", ts:datetime("2025-09-10T10:02:00Z"), qty:1},
    {type:"VIEWED",    sku:"SKU-1002", ts:datetime("2025-09-11T08:15:00Z"), qty:1},
    {type:"ADDED_TO_CART", sku:"SKU-3001", ts:datetime("2025-09-11T08:17:00Z"), qty:1}
  ]},
  {userId:"u_alex",    events:[
    {type:"PURCHASED", sku:"SKU-2001", ts:datetime("2025-09-09T12:30:00Z"), qty:1},
    {type:"VIEWED",    sku:"SKU-3001", ts:datetime("2025-09-09T12:45:00Z"), qty:1}
  ]},
  {userId:"u_poojitha",events:[
    {type:"VIEWED",    sku:"SKU-1101", ts:datetime("2025-09-12T07:40:00Z"), qty:1},
    {type:"PURCHASED", sku:"SKU-1201", ts:datetime("2025-09-12T07:55:00Z"), qty:2},
    {type:"PURCHASED", sku:"SKU-1402", ts:datetime("2025-09-13T09:05:00Z"), qty:1}
  ]},
  {userId:"u_riya",    events:[
    {type:"VIEWED",    sku:"SKU-2101", ts:datetime("2025-09-08T18:10:00Z"), qty:1},
    {type:"ADDED_TO_CART", sku:"SKU-2102", ts:datetime("2025-09-08T18:15:00Z"), qty:1},
    {type:"PURCHASED", sku:"SKU-1501", ts:datetime("2025-09-08T18:20:00Z"), qty:1}
  ]},
  {userId:"u_sam",     events:[
    {type:"PURCHASED", sku:"SKU-3002", ts:datetime("2025-09-07T14:01:00Z"), qty:1},
    {type:"VIEWED",    sku:"SKU-3301", ts:datetime("2025-09-07T14:05:00Z"), qty:1},
    {type:"PURCHASED", sku:"SKU-3001", ts:datetime("2025-09-07T14:20:00Z"), qty:1}
  ]},
  {userId:"u_lena",    events:[
    {type:"VIEWED",    sku:"SKU-1301", ts:datetime("2025-09-06T09:15:00Z"), qty:1},
    {type:"PURCHASED", sku:"SKU-1003", ts:datetime("2025-09-06T09:25:00Z"), qty:1},
    {type:"PURCHASED", sku:"SKU-1401", ts:datetime("2025-09-06T09:30:00Z"), qty:1}
  ]}
] AS row
MATCH (u:User {userId: row.userId})
UNWIND row.events AS e
MATCH (p:Product {sku: e.sku})
FOREACH (_ IN CASE WHEN e.type = "VIEWED" THEN [1] ELSE [] END |
  MERGE (u)-[r:VIEWED]->(p) SET r.at = e.ts
)
FOREACH (_ IN CASE WHEN e.type = "ADDED_TO_CART" THEN [1] ELSE [] END |
  MERGE (u)-[r:ADDED_TO_CART]->(p) SET r.at = e.ts, r.qty = e.qty
)
FOREACH (_ IN CASE WHEN e.type = "PURCHASED" THEN [1] ELSE [] END |
  MERGE (u)-[r:PURCHASED]->(p) SET r.at = e.ts, r.qty = e.qty
);

// ---------- Derive ALSO_BOUGHT ----------
MATCH (u:User)-[:PURCHASED]->(a:Product)
MATCH (u)-[:PURCHASED]->(b:Product)
WHERE a <> b
WITH a, b, count(*) AS c
MERGE (a)-[r:ALSO_BOUGHT]->(b)
SET r.count = coalesce(r.count,0) + c;

// ---------- Manual boosts ----------
MATCH (a:Product {sku:"SKU-1001"})
MATCH (b:Product {sku:"SKU-1201"})
MERGE (a)-[r:ALSO_BOUGHT]->(b)
SET r.count = coalesce(r.count,0) + 2;

MATCH (a:Product {sku:"SKU-2101"})
MATCH (b:Product {sku:"SKU-2102"})
MERGE (a)-[r:ALSO_BOUGHT]->(b)
SET r.count = coalesce(r.count,0) + 2;

MATCH (a:Product {sku:"SKU-3002"})
MATCH (b:Product {sku:"SKU-3001"})
MERGE (a)-[r:ALSO_BOUGHT]->(b)
SET r.count = coalesce(r.count,0) + 2;
