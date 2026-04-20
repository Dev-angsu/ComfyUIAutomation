//@api-1.0
// wildcards
// author dev-angsu
// v0.3

//Anime waifus - Real life cosplay sexy porn

const configuration = pipeline.configuration; // Use the current config from the UI

//Total images = configuration.batchCount * independentBuilds
configuration.batchCount = 1; // image per prompt
const independentBuilds = 300; // no.of prompts
let totalImages = 0;

const templates = [
  "Create a STYLE a CHARACTER in PLACE in POSE VIEWPOINT. SETTING. CHARPROP. Accessories she has: ACCESSORIES. Horny aroused cute expression",
];
//Prompt builder dictionary
const dictionary = {
  STYLE: ["anime hyper-detailed image of"], // Changed for more impact
  VIEWPOINT: [
    "low angle shot, looking up at her vulnerability",
    "extreme close-up on her body",
    "dutch angle capturing her body",
    "over-the-shoulder view from the aggressor's perspective",
  ],
  CHARACTER: [
    "Rem (Re:Zero)",
    "Asuna (SAO)",
    "Holo (Spice and Wolf)",
    "Yor Forger (Spy x Family)",
    "Marin Kitagawa (My Dress Up Darling)",
    "Yor Forger from Spy family",
    "Rem from Re:Zero",
    "Asuna Yuuki from SAO",
    "arima kana from oshi no ko",
    "Chika Fujiwara (Kaguya-sama)",
    "Holo (Spice and Wolf)",
    "Yuna (Final Fantasy XIII)",
    "Mikasa Ackerman (Attack on Titan)",
    "Nami (One Piece)",
    "Alya from Alya sometimes hides her feelings",
    "Mai Sakurajima from Bunny girl",
    "Zero Two from Darling in the franxx",
    "Noelle from Genshin Impact",
    "Rei Ayanami (Evangelion)",
    "Madoka Kaname (Madoka Magica)",
    "Rem (Re:Zero)",
    "Asuka Langley Soryu (Evangelion)",
    "Nezuko Kamado (Demon Slayer)",
    "Marin Kitagawa (My Dress-Up Darling)",
    "Yor Forger (Spy x Family)",
    "Holo (Spice and Wolf)",
    "Kaguya Shinomiya (Kaguya-sama: Love is War)",
    "Chika Fujiwara (Kaguya-sama)",
    "Zero Two (Darling in the Franxx)",
    "Marinette Dupain-Cheng (Miraculous Ladybug)",
    "Violet Evergarden (Violet Evergarden)",
    "Mikasa Ackerman (Attack on Titan)",
    "Erza Scarlet (Fairy Tail)",
    "Usagi Tsukino/Sailor Moon (Sailor Moon)",
    "Ram (Re:Zero)",
    "Konata Izumi (Lucky Star)",
    "Tohru Honda (Fruits Basket)",
    "Megumin (KonoSuba)",
    "Aqua (KonoSuba)",
    "Shiro (No Game No Life)",
    "Rem (Re:Zero) - *Duplicate for variety*",
    "Hatsune Miku (Vocaloid/General)",
    "Yui Hirasawa (K-On!)",
    "Hinata Hyuga (Naruto)",
    "Nami (One Piece)",
    "Boa Hancock (One Piece)",
    "Sailor Mercury (Usagi Tsukino)",
    "Kirito's Partner (Asuna - SAO)",
    "Makise Kurisu (Steins;Gate)",
    "Chitoge Kirisaki (Nisekoi)",
    "Miku Nakano (The Quintessential Quintuplets)",
    "Kanna Kamui (Miss Kobayashi's Dragon Maid)",
    "Tsubasa Hanekawa (Monogatari Series)",
    "Yuno Gasai (Future Diary)",
    "Mai Sakurajima (Rascal Does Not Dream of Bunny Girl Senpai)",
    "Nichijou's Mio (Nichijou)",
    "Karyl Ashikaga (Re:Zero)",
    "Saber/Artoria Pendragon (Fate Series)",
    "Roselia Nodoka (Madoka Magica)",
    "Emiya Shirou (Fate Series)",
    "Lumine from Genshin impact",
    "Keqing from Genshin impact",
    "Xiangling from genshin impact",
    "barbara from genshin impact",
  ],
  PLACE: [
    "an infinite white-void gallery with floating holographic sculptures",
    "a vertical greenhouse skyscraper with glowing synthetic flora",
    "a zero-gravity luxury lounge where liquid orbs float mid-air",
    "a brutalist concrete megastructure suspended over a sea of colourful clouds",
    "a mirrored labyrinth reflecting a thousand distorted neon signs",
    "a hyper-modern hospital room with cyberpunk sci fi tech all around",
    "a glass-bottomed observation deck hovering above a smog-choked abyss",
    "a surrealist desert of white sand and dust storm raging in distance with magical equipments lying around her",
    "a high-fashion 'runway' bridge spanning between two rotating towers",
    "an indoor rain-chamber where water droplets defy gravity",
    "a monochromatic 'liminal space' subway station with infinite stairs",
    "a futuristic 'zen garden' made entirely of fiber-optic wires",
    "a luxury penthouse inside a massive, hollowed-out satellite",
    "a neon-lit cathedral built from recycled computer motherboards",
    "a dense 'vertical shanty-town' with gravity-defying architecture",
    "a space station with modern NASA gadgets inside it",
    "a Japanese school classroom with sexy students around her touching her vagina",
    "a airplane inside, shes working as a airhostress who's getting raped by other people",
    "she's pulling a cart full of people with a rope attached to her waist, in an indian road, painful bloody",
  ],
  POSE: [
    "arching her back desperately while being pinned down, legs spread wide",
    "leaning back against a rough wooden beam, legs spread wide in submission wet vagina piss dripping",
    "cowering slightly, head tilted back exposing throat and neck, legs spread wide",
    "straining upwards, one hand gripping the aggressor's arm, legs spread wide",
    "leaning back provocatively with legs spread wide, one leg folded, hand on vagina",
    "casually draped over a railing, hands on boobs, nipples visible, biting lips",
    "sitting sideways on a wet floor, knees drawn up, pulling dress up exposing wet thighs and part of vagina",
    "stretching languidly against a wall, pulling dress up to show wet vagina",
    "walking away but glancing back over her shoulder with hand on her ass and boobs",
    "leaning forward with hands between legs, big boobs, orgasm face, legs spread wide",
    "reclining dramatically across a low table hands on boobs, one nipple slip",
    "standing with one hip jutted out hand between legs and hand on hip, legs spread wide",
    "standing in a classroom with wide stance, one hand between legs, one hand in hair, piss dropping from her legs",
    "having sex with a man in bedroom with wide stance, crying eyes, aroused",
    "a doctor is investigating her body vagina and boobs",
    "shes giving a blowjob deep throat with hand on her wet vagina water dripping",
  ],
  SETTING: [
    "during a sudden downpour outside the window",
    "surrounded by scattered antique lace and silk sheets",
    "with shafts of golden afternoon sunlight cutting through dust motes",
    "in a state of disarray after a passionate struggle",
    "against a backdrop of overgrown, wild ivy clinging to the wall",
    "soft bloom lighting and cherry blossoms",
    "intense rainfall",
    "high contrast noir (rainy night)",
    "golden hour haze",
    "ethereal glow filtering through paper screens (shoji)",
    "dramatic lighting from a single streetlamp",
    "soft focus bokeh effect",
    "cinematic volumetric fog",
  ],
  //CHARPROP: ["a torn, sheer white slip dress barely covering her hips", "a ripped, vibrant red corset top exposing midriff and cleavage", "a delicate, wet lace chemise pulled up around her waist", "a strategically shredded black vinyl bodysuit showing off curves", "a translucent, gossamer kimono partially slipped off one shoulder", "wearing a short floral sundress, big boobs", "in a sheer sailor uniform", "draped in delicate sheer silk kimono scraps", "with glowing cybernetic accents and sheer sundress", "holding a steaming matcha bowl, short floral sundress", "sunglasses in hair, vibrator in vagina, short floral sundress", "accessorized with dangling charms, short kimono dress", "cleavage visible in a short office dress with slit", "wearing intricate makeup (heavy eyeliner) in a short sheer saree", "adorned with tiny bells on her hair, saree style mini dress"],

  CHARPROP: [
    "a ruby red Banarasi lehenga with a backless blouse and deep plunging neckline",
    "a sheer midnight blue chiffon saree draped low-waist with a metallic halter-neck choli",
    "an emerald green velvet sharara with high side slits and heavy mirror-work detailing",
    "a rose gold metallic pre-stitched saree featuring a corset bodice and thigh-high slit",
    "an ivory lace anarkali gown with sheer sleeves and a cutout waist",
    "a vibrant mustard yellow Kanjeevaram silk saree worn in a short dhoti style",
    "a teal printed silk boho-saree paired with a tiny leather-look crop top",
    "a black and silver sequin cocktail saree with a thin-strap bikini-style blouse",
    "a pastel lavender Chikankari lehenga with a sheer dupatta and embroidered bustier",
    "a scarlet silk trouser and cape set with a gold-trimmed plunging bralette",
    "a Bengali red and white saree full of ornaments and sheer fabric",
    "sheer sexy modern saree",
  ],
  //ACCESSORIES: ["choker made of intertwined thorns with a small blood drop pendant", "thigh bands adorned with silver chains and tassels", "a length of dark red silk rope wrapped tightly around her neck and chest", "a glowing smartphone clutched uselessly in one hand", "delicate, wet pearl body chains draped across her stomach and hips"]

  ACCESSORIES: [
    "a delicate gold kamarbandh cinched tightly around a bare waist",
    "a pair of oversized silver chandbalis brushing against the shoulders",
    "a heavy kundan choker paired with a plunging neckline",
    "an ornate maang tikka resting on a sleek center-parted hairstyle",
    "a stack of thin glass bangles clinking on slender wrists",
    "a sparkling diamond nose ring with a thin gold chain to the ear",
    "an oxidized silver haath-phool decorating the back of the hand",
    "a thin black thread anklet with a single silver charm",
    "a wide temple-work gold belt layered over a sheer saree",
    "a pair of tiered jhumkas with delicate pearl bead drops",
    "a shimmering crystal bindi placed between arched brows",
    "a velvet potli bag with heavy gold tassels and embroidery",
    "a set of metallic toe rings on henna-patterned feet",
    "a sleek emerald-encrusted cocktail ring on a manicured hand",
    "a heavy tribal statement necklace layered over bare skin",
    "a delicate gold waist chain resting low on the hips",
    "a pair of heavy silver anklets with melodic bells",
    "a black leather harness worn over a sheer silk saree",
    "a set of ornate kundan cuffs with finger rings attached",
    "a stack of thin metallic bangles reaching up to the elbows",
    "a ruby-encrusted navel piercing with a hanging gemstone",
    "a sheer lace veil draped provocatively over the eyes",
    "a thick velvet choker with a gold temple jewelry pendant",
    "a pair of thigh-high leather boots paired with an ethnic mini",
    "a gold-plated nose ring with a delicate chain tucked behind the ear",
    "a wide embroidered leather belt clinching a flowing lehenga",
    "a set of silver toe rings worn on bare feet",
    "a shimmering crystal body chain worn under a plunging blouse",
    "a pair of oversized oxidized silver jhumkas that brush the shoulders",
    "a silk tassel whip with a carved sandalwood handle",
  ],
};

/**
 * Generates a random prompt based on the dictionary
 * @param {string} template - The string containing CAPITALIZED placeholders
 * @returns {string} - The processed prompt
 */
function buildPrompt(template) {
  let result = template;

  // Iterate through each key in our dictionary
  Object.keys(dictionary).forEach((key) => {
    const options = dictionary[key];
    // Pick a random element from the array
    const randomValue = options[Math.floor(Math.random() * options.length)];

    // Replace the placeholder (e.g., "CHARACTER") with the random value
    // Using a global regex in case the placeholder appears twice
    result = result.replaceAll(key, randomValue);
  });

  return result;
}

//functions

function r(max) {
  return Math.floor(max ? Math.random() * max : Math.random() * 1_000_000_000);
}

for (let i = 0; i < independentBuilds; i++) {
  configuration.seed = r();

  const randomTemplate =
    templates[Math.floor(Math.random() * templates.length)];
  const Prompt = buildPrompt(randomTemplate);

  console.log("Prompt " + Prompt + " || Seed = " + configuration.seed);

  pipeline.run({
    configuration: configuration,
    prompt: Prompt,
  }); // Draw something

  totalImages = totalImages + configuration.batchCount;

  console.log(totalImages);
}
