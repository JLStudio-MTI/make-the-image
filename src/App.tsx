import { useEffect, useState } from "react";
import CanvasGrid, { GRID_WIDTH, GRID_HEIGHT } from "./components/CanvasGrid";
import ColorPalette from "./components/ColorPalette";
import Header from "./components/Header";
import Leaderboard from "./components/Leaderboard";
import { supabase } from "./lib/supabaseClient";
import { useToast } from "./components/ui/Toaster";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const LS_USERNAME = "pp_username";
const LS_LAST_PLACED_AT = "pp_lastPlacedAt";
const LS_DEVICE_ID = "pp_deviceId";


// --- Username validation helpers ---
const bannedWords = [
  // keep this short at first; expand over time
  "abbo", "abo", "abortion", "abuse", "addict", "addicts", "adult", "africa", "african", "alla", "allah", "alligatorbait", "amateur", "american", "anal", "analannie", "analsex", "angie", "angry", "anus", "arab", "arabs", "areola", "argie", "aroused", "arse", "arsehole", "asian", "ass", "assassin", "assassinate", "assassination", "assault", "assbagger", "assblaster", "assclown", "asscowboy", "asses", "assfuck", "assfucker", "asshat", "asshole", "assholes", "asshore", "assjockey", "asskiss", "asskisser", "assklown", "asslick", "asslicker", "asslover", "assman", "assmonkey", "assmunch", "assmuncher", "asspacker", "asspirate", "asspuppies", "assranger", "asswhore", "asswipe", "athletesfoot", "attack", "australian", "babe", "babies", "backdoor", "backdoorman", "backseat", "badfuck", "balllicker", "balls", "ballsack", "banging", "baptist", "barelylegal", "barf", "barface", "barfface", "bast", "bastard", "bazongas", "bazooms", "beaner", "beast", "beastality", "beastial", "beastiality", "beatoff", "beat-off", "beatyourmeat", "beaver", "bestial", "bestiality", "bi", "biatch", "bible", "bicurious", "bigass", "bigbastard", "bigbutt", "bigger", "bisexual", "bi-sexual", "bitch", "bitcher", "bitches", "bitchez", "bitchin", "bitching", "bitchslap", "bitchy", "biteme", "black", "blackman", "blackout", "blacks", "blind", "blow", "blowjob", "boang", "bogan", "bohunk", "bollick", "bollock", "bomb", "bombers", "bombing", "bombs", "bomd", "bondage", "boner", "bong", "boob", "boobies", "boobs", "booby", "boody", "boom", "boong", "boonga", "boonie", "booty", "bootycall", "bountybar", "bra", "brea5t", "breast", "breastjob", "breastlover", "breastman", "brothel", "bugger", "buggered", "buggery", "bullcrap", "bulldike", "bulldyke", "bullshit", "bumblefuck", "bumfuck", "bunga", "bunghole", "buried", "burn", "butchbabes", "butchdike", "butchdyke", "butt", "buttbang", "butt-bang", "buttface", "buttfuck", "butt-fuck", "buttfucker", "butt-fucker", "buttfuckers", "butt-fuckers", "butthead", "buttman", "buttmunch", "buttmuncher", "buttpirate", "buttplug", "buttstain", "byatch", "cacker", "cameljockey", "cameltoe", "canadian", "cancer", "carpetmuncher", "carruth", "catholic", "catholics", "cemetery", "chav", "cherrypopper", "chickslick", "children's", "chin", "chinaman", "chinamen", "chinese", "chink", "chinky", "choad", "chode", "christ", "christian", "church", "cigarette", "cigs", "clamdigger", "clamdiver", "clit", "clitoris", "clogwog", "cocaine", "cock", "cockblock", "cockblocker", "cockcowboy", "cockfight", "cockhead", "cockknob", "cocklicker", "cocklover", "cocknob", "cockqueen", "cockrider", "cocksman", "cocksmith", "cocksmoker", "cocksucer", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocktail", "cocktease", "cocky", "cohee", "coitus", "color", "colored", "coloured", "commie", "communist", "condom", "conservative", "conspiracy", "coolie", "cooly", "coon", "coondog", "copulate", "cornhole", "corruption", "cra5h", "crabs", "crack", "crackpipe", "crackwhore", "crack-whore", "crap", "crapola", "crapper", "crappy", "crash", "creamy", "crime", "crimes", "criminal", "criminals", "crotch", "crotchjockey", "crotchmonkey", "crotchrot", "cum", "cumbubble", "cumfest", "cumjockey", "cumm", "cummer", "cumming", "cumquat", "cumqueen", "cumshot", "cunilingus", "cunillingus", "cunn", "cunnilingus", "cunntt", "cunt", "cunteyed", "cuntfuck", "cuntfucker", "cuntlick", "cuntlicker", "cuntlicking", "cuntsucker", "cybersex", "cyberslimer", "dago", "dahmer", "dammit", "damn", "damnation", "damnit", "darkie", "darky", "datnigga", "dead", "deapthroat", "death", "deepthroat", "defecate", "dego", "demon", "deposit", "desire", "destroy", "deth", "devil", "devilworshipper", "dick", "dickbrain", "dickforbrains", "dickhead", "dickless", "dicklick", "dicklicker", "dickman", "dickwad", "dickweed", "diddle", "die", "died", "dies", "dike", "dildo", "dingleberry", "dink", "dipshit", "dipstick", "dirty", "disease", "diseases", "disturbed", "dive", "dix", "dixiedike", "dixiedyke", "doggiestyle", "doggystyle", "dong", "doodoo", "doo-doo", "doom", "dope", "dragqueen", "dragqween", "dripdick", "drug", "drunk", "drunken", "dumb", "dumbass", "dumbbitch", "dumbfuck", "dyefly", "dyke", "easyslut", "eatballs", "eatme", "eatpussy", "ecstacy", "ejaculate", "ejaculated", "ejaculating", "ejaculation", "enema", "enemy", "erect", "erection", "ero", "escort", "ethiopian", "ethnic", "european", "evl", "excrement", "execute", "executed", "execution", "executioner", "explosion", "facefucker", "faeces", "fag", "fagging", "faggot", "fagot", "failed", "failure", "fairies", "fairy", "faith", "fannyfucker", "fart", "farted", "farting", "farty", "fastfuck", "fat", "fatah", "fatass", "fatfuck", "fatfucker", "fatso", "fckcum", "fear", "feces", "felatio", "felch", "felcher", "felching", "fellatio", "feltch", "feltcher", "feltching", "fetish", "fight", "filipina", "filipino", "fingerfood", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fire", "firing", "fister", "fistfuck", "fistfucked", "fistfucker", "fistfucking", "fisting", "flange", "flasher", "flatulence", "floo", "flydie", "flydye", "fok", "fondle", "footaction", "footfuck", "footfucker", "footlicker", "footstar", "fore", "foreskin", "forni", "fornicate", "foursome", "fourtwenty", "fraud", "freakfuck", "freakyfucker", "freefuck", "fu", "fubar", "fuc", "fucck", "fuck", "fucka", "fuckable", "fuckbag", "fuckbuddy", "fucked", "fuckedup", "fucker", "fuckers", "fuckface", "fuckfest", "fuckfreak", "fuckfriend", "fuckhead", "fuckher", "fuckin", "fuckina", "fucking", "fuckingbitch", "fuckinnuts", "fuckinright", "fuckit", "fuckknob", "fuckme", "fuckmehard", "fuckmonkey", "fuckoff", "fuckpig", "fucks", "fucktard", "fuckwhore", "fuckyou", "fudgepacker", "fugly", "fuk", "fuks", "funeral", "funfuck", "fungus", "fuuck", "gangbang", "gangbanged", "gangbanger", "gangsta", "gatorbait", "gay", "gaymuthafuckinwhore", "gaysex", "geez", "geezer", "geni", "genital", "german", "getiton", "gin", "ginzo", "gipp", "girls", "givehead", "glazeddonut", "gob", "god", "godammit", "goddamit", "goddammit", "goddamn", "goddamned", "goddamnes", "goddamnit", "goddamnmuthafucker", "goldenshower", "gonorrehea", "gonzagas", "gook", "gotohell", "goy", "goyim", "greaseball", "gringo", "groe", "gross", "grostulation", "gubba", "gummer", "gun", "gyp", "gypo", "gypp", "gyppie", "gyppo", "gyppy", "hamas", "handjob", "hapa", "harder", "hardon", "harem", "headfuck", "headlights", "hebe", "heeb", "hell", "henhouse", "heroin", "herpes", "heterosexual", "hijack", "hijacker", "hijacking", "hillbillies", "hindoo", "hiscock", "hitler", "hitlerism", "hitlerist", "hiv", "hobo", "hodgie", "hoes", "hole", "holestuffer", "homicide", "homo", "homobangers", "homosexual", "honger", "honk", "honkers", "honkey", "honky", "hook", "hooker", "hookers", "hooters", "hore", "hork", "horn", "horney", "horniest", "horny", "horseshit", "hosejob", "hoser", "hostage", "hotdamn", "hotpussy", "hottotrot", "hummer", "husky", "hussy", "hustler", "hymen", "hymie", "iblowu", "idiot", "ikey", "illegal", "incest", "insest", "intercourse", "interracial", "intheass", "inthebuff", "israel", "israeli", "israel's", "italiano", "itch", "jackass", "jackoff", "jackshit", "jacktheripper", "jade", "jap", "japanese", "japcrap", "jebus", "jeez", "jerkoff", "jesus", "jesuschrist", "jew", "jewish", "jiga", "jigaboo", "jigg", "jigga", "jiggabo", "jigger", "jiggy", "jihad", "jijjiboo", "jimfish", "jism", "jiz", "jizim", "jizjuice", "jizm", "jizz", "jizzim", "jizzum", "joint", "juggalo", "jugs", "junglebunny", "kaffer", "kaffir", "kaffre", "kafir", "kanake", "kid", "kigger", "kike", "kill", "killed", "killer", "killing", "kills", "kink", "kinky", "kissass", "kkk", "knife", "knockers", "kock", "kondum", "koon", "kotex", "krap", "krappy", "kraut", "kum", "kumbubble", "kumbullbe", "kummer", "kumming", "kumquat", "kums", "kunilingus", "kunnilingus", "kunt", "ky", "kyke", "lactate", "laid", "lapdance", "latin", "lesbain", "lesbayn", "lesbian", "lesbin", "lesbo", "lez", "lezbe", "lezbefriends", "lezbo", "lezz", "lezzo", "liberal", "libido", "licker", "lickme", "lies", "limey", "limpdick", "limy", "lingerie", "liquor", "livesex", "loadedgun", "lolita", "looser", "loser", "lotion", "lovebone", "lovegoo", "lovegun", "lovejuice", "lovemuscle", "lovepistol", "loverocket", "lowlife", "lsd", "lubejob", "lucifer", "luckycammeltoe", "lugan", "lynch", "macaca", "mad", "mafia", "magicwand", "mams", "manhater", "manpaste", "marijuana", "mastabate", "mastabater", "masterbate", "masterblaster", "mastrabator", "masturbate", "masturbating", "mattressprincess", "meatbeatter", "meatrack", "meth", "mexican", "mgger", "mggor", "mickeyfinn", "mideast", "milf", "minority", "mockey", "mockie", "mocky", "mofo", "moky", "moles", "molest", "molestation", "molester", "molestor", "moneyshot", "mooncricket", "mormon", "moron", "moslem", "mosshead", "mothafuck", "mothafucka", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckin", "mothafucking", "mothafuckings", "motherfuck", "motherfucked", "motherfucker", "motherfuckin", "motherfucking", "motherfuckings", "motherlovebone", "muff", "muffdive", "muffdiver", "muffindiver", "mufflikcer", "mulatto", "muncher", "munt", "murder", "murderer", "muslim", "naked", "narcotic", "nasty", "nastybitch", "nastyho", "nastyslut", "nastywhore", "nazi", "necro", "negro", "negroes", "negroid", "negro's", "nig", "niger", "nigerian", "nigerians", "nigg", "nigga", "niggah", "niggaracci", "niggard", "niggarded", "niggarding", "niggardliness", "niggardliness's", "niggardly", "niggards", "niggard's", "niggaz", "nigger", "niggerhead", "niggerhole", "niggers", "nigger's", "niggle", "niggled", "niggles", "niggling", "nigglings", "niggor", "niggur", "niglet", "nignog", "nigr", "nigra", "nigre", "nip", "nipple", "nipplering", "nittit", "nlgger", "nlggor", "nofuckingway", "nook", "nookey", "nookie", "noonan", "nooner", "nude", "nudger", "nuke", "nutfucker", "nymph", "ontherag", "oral", "orga", "orgasim", "orgasm", "orgies", "orgy", "osama", "paki", "palesimian", "palestinian", "pansies", "pansy", "panti", "panties", "payo", "pearlnecklace", "peck", "pecker", "peckerwood", "pee", "peehole", "pee-pee", "peepshow", "peepshpw", "pendy", "penetration", "peni5", "penile", "penis", "penises", "penthouse", "period", "perv", "phonesex", "phuk", "phuked", "phuking", "phukked", "phukking", "phungky", "phuq", "pi55", "picaninny", "piccaninny", "pickaninny", "piker", "pikey", "piky", "pimp", "pimped", "pimper", "pimpjuic", "pimpjuice", "pimpsimp", "pindick", "piss", "pissed", "pisser", "pisses", "pisshead", "pissin", "pissing", "pissoff", "pistol", "pixie", "pixy", "playboy", "playgirl", "pocha", "pocho", "pocketpool", "pohm", "polack", "pom", "pommie", "pommy", "poo", "poon", "poontang", "poop", "pooper", "pooperscooper", "pooping", "poorwhitetrash", "popimp", "porchmonkey", "porn", "pornflick", "pornking", "porno", "pornography", "pornprincess", "pot", "poverty", "premature", "pric", "prick", "prickhead", "primetime", "propaganda", "pros", "prostitute", "protestant", "pu55i", "pu55y", "pube", "pubic", "pubiclice", "pud", "pudboy", "pudd", "puddboy", "puke", "puntang", "purinapricness", "puss", "pussie", "pussies", "pussy", "pussycat", "pussyeater", "pussyfucker", "pussylicker", "pussylips", "pussylover", "pussypounder", "pusy", "quashie", "queef", "queer", "quickie", "quim", "ra8s", "rabbi", "racial", "racist", "radical", "radicals", "raghead", "randy", "rape", "raped", "raper", "rapist", "rearend", "rearentry", "rectum", "redlight", "redneck", "reefer", "reestie", "refugee", "reject", "remains", "rentafuck", "republican", "rere", "retard", "retarded", "ribbed", "rigger", "rimjob", "rimming", "roach", "robber", "roundeye", "rump", "russki", "russkie", "sadis", "sadom", "samckdaddy", "sandm", "sandnigger", "satan", "scag", "scallywag", "scat", "schlong", "screw", "screwyou", "scrotum", "scum", "semen", "seppo", "servant", "sex", "sexed", "sexfarm", "sexhound", "sexhouse", "sexing", "sexkitten", "sexpot", "sexslave", "sextogo", "sextoy", "sextoys", "sexual", "sexually", "sexwhore", "sexy", "sexymoma", "sexy-slim", "shag", "shaggin", "shagging", "shat", "shav", "shawtypimp", "sheeney", "shhit", "shinola", "shit", "shitcan", "shitdick", "shite", "shiteater", "shited", "shitface", "shitfaced", "shitfit", "shitforbrains", "shitfuck", "shitfucker", "shitfull", "shithapens", "shithappens", "shithead", "shithouse", "shiting", "shitlist", "shitola", "shitoutofluck", "shits", "shitstain", "shitted", "shitter", "shitting", "shitty", "shoot", "shooting", "shortfuck", "showtime", "sick", "sissy", "sixsixsix", "sixtynine", "sixtyniner", "skank", "skankbitch", "skankfuck", "skankwhore", "skanky", "skankybitch", "skankywhore", "skinflute", "skum", "skumbag", "slant", "slanteye", "slapper", "slaughter", "slav", "slave", "slavedriver", "sleezebag", "sleezeball", "slideitin", "slime", "slimeball", "slimebucket", "slopehead", "slopey", "slopy", "slut", "sluts", "slutt", "slutting", "slutty", "slutwear", "slutwhore", "smack", "smackthemonkey", "smut", "snatch", "snatchpatch", "snigger", "sniggered", "sniggering", "sniggers", "snigger's", "sniper", "snot", "snowback", "snownigger", "sob", "sodom", "sodomise", "sodomite", "sodomize", "sodomy", "sonofabitch", "sonofbitch", "sooty", "sos", "soviet", "spaghettibender", "spaghettinigger", "spank", "spankthemonkey", "sperm", "spermacide", "spermbag", "spermhearder", "spermherder", "spic", "spick", "spig", "spigotty", "spik", "spit", "spitter", "splittail", "spooge", "spreadeagle", "spunk", "spunky", "squaw", "stagg", "stiffy", "strapon", "stringer", "stripclub", "stroke", "stroking", "stupid", "stupidfuck", "stupidfucker", "suck", "suckdick", "sucker", "suckme", "suckmyass", "suckmydick", "suckmytit", "suckoff", "suicide", "swallow", "swallower", "swalow", "swastika", "sweetness", "syphilis", "taboo", "taff", "tampon", "tang", "tantra", "tarbaby", "tard", "teat", "terror", "terrorist", "teste", "testicle", "testicles", "thicklips", "thirdeye", "thirdleg", "threesome", "threeway", "timbernigger", "tinkle", "tit", "titbitnipply", "titfuck", "titfucker", "titfuckin", "titjob", "titlicker", "titlover", "tits", "tittie", "titties", "titty", "tnt", "toilet", "tongethruster", "tongue", "tonguethrust", "tonguetramp", "tortur", "torture", "tosser", "towelhead", "trailertrash", "tramp", "trannie", "tranny", "transexual", "transsexual", "transvestite", "triplex", "trisexual", "trojan", "trots", "tuckahoe", "tunneloflove", "turd", "turnon", "twat", "twink", "twinkie", "twobitwhore", "uck", "uk", "unfuckable", "upskirt", "uptheass", "upthebutt", "urinary", "urinate", "urine", "usama", "uterus", "vagina", "vaginal", "vatican", "vibr", "vibrater", "vibrator", "vietcong", "violence", "virgin", "virginbreaker", "vomit", "vulva", "wab", "wank", "wanker", "wanking", "waysted", "weapon", "weenie", "weewee", "welcher", "welfare", "wetb", "wetback", "wetspot", "whacker", "whash", "whigger", "whiskey", "whiskeydick", "whiskydick", "whit", "whitenigger", "whites", "whitetrash", "whitey", "whiz", "whop", "whore", "whorefucker", "whorehouse", "wigger", "willie", "williewanker", "willy", "wn", "wog", "women's", "wop", "wtf", "wuss", "wuzzie", "xtc", "xxx", "yankee", "yellowman", "zigabo", "zipperhead"

];

const isOffensive = (name: string) => {
  const n = name.toLowerCase();
  return bannedWords.some(w => n.includes(w));
};

const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
function findBannedHit(name: string, list: string[]) {
  const lower = name.toLowerCase();
  for (const w of list) {
    if (!w) continue;
    const idx = lower.indexOf(w.toLowerCase());
    if (idx !== -1) return { word: w, start: idx, end: idx + w.length };
  }
  return null;
}


const ensureDeviceId = () => {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
};

function UsernameModal({
  defaultName = "",
  onSave,
}: {
  defaultName?: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(defaultName);

  const lengthValid = usernameRegex.test(value);
  const hit = findBannedHit(value, bannedWords); // your big list
  const isValid = lengthValid && !hit;

  // helper to render the string with <mark> around the bad piece
  const renderWithMark = () => {
    if (!hit) return null;
    const { start, end } = hit;
    const before = value.slice(0, start);
    const bad = value.slice(start, end);
    const after = value.slice(end);
    return (
      <span className="font-mono">
        {before}
        <mark className="bg-red-200 px-0.5 rounded">{bad}</mark>
        {after}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-xl font-bold">Pick your permanent username</h2>
        <p className="mb-3 text-sm text-gray-600">
          You’ll use this name forever on this canvas. No email, no sign in.
        </p>
        <p className="mt-1 text-[11px] text-gray-500">
          Tip: use a name similar to your Instagram for shoutouts.
        </p>


        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. PixelWizard_15"
          className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 ${
            isValid
              ? "border-gray-300 focus:ring-blue-500"
              : "border-red-300 focus:ring-red-400"
          }`}
        />

        {!lengthValid && (
          <div className="mt-2 text-xs text-red-600">
            Usernames must be 3–16 characters (letters, numbers, underscore).
          </div>
        )}

        {hit && (
          <div className="mt-2 text-xs text-red-600">
            Contains a disallowed term: {renderWithMark()}
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Allowed: 3–16 chars (letters, numbers, underscore)
        </p>

        <button
          disabled={!isValid}
          onClick={() => onSave(value)}
          className={`mt-4 w-full rounded-lg px-4 py-2 font-semibold text-white transition ${
            isValid ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          Save username
        </button>
      </div>
    </div>
  );
}


function App() {
  const { push } = useToast();

  const resetUsername = () => {
  localStorage.removeItem(LS_USERNAME);
  setUsername(null);
  setNeedsUsername(true);
};

const resetCooldown = () => {
  localStorage.removeItem(LS_LAST_PLACED_AT);
  setLastPlacedAt(0);
};

const resetDeviceId = () => {
  localStorage.removeItem(LS_DEVICE_ID);
  // optional: immediately re-create a fresh id
  // ensureDeviceId();
};

  const [selectedColor, setSelectedColor] = useState("#000000");

  // Forever username
  const [username, setUsername] = useState<string | null>(null);
  const [needsUsername, setNeedsUsername] = useState(false);

  // Cooldown
  const [now, setNow] = useState(() => Date.now());
  const [lastPlacedAt, setLastPlacedAt] = useState<number>(() => {
    const raw = localStorage.getItem(LS_LAST_PLACED_AT);
    return raw ? parseInt(raw, 10) : 0;
  });

  // Stats
  const totalCells = GRID_WIDTH * GRID_HEIGHT;
  const [nonWhite, setNonWhite] = useState(0);      // revealed pixels on canvas
  const [myPlaced, setMyPlaced] = useState(0);      // your personal placements (session + future we can load server-side)

  // Zoom
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 1));

  // Boot
  useEffect(() => {
    ensureDeviceId();

    const saved = localStorage.getItem(LS_USERNAME);
    if (saved && saved.trim()) {
      setUsername(saved.trim());
      setNeedsUsername(false);
    } else {
      setNeedsUsername(true);
    }
  }, []);

  // Optional: load your historical placements by username (best-effort; later we’ll move to device_id)
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!username) return;
      const { count, error } = await supabase
        .from("PixelDatabase")
        .select("*", { count: "exact", head: true })
        .eq("username", username);
      if (!canceled && !error && typeof count === "number") {
        setMyPlaced(count);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [username]);

  // 1-second ticker for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msRemaining = Math.max(0, lastPlacedAt + COOLDOWN_MS - now);
  const canPlace = msRemaining <= 0;

  const formatTime = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };


const handleSaveUsername = async (name: string) => {
  const clean = name.trim();

  // 1) Client validation
  if (!usernameRegex.test(clean)) {
    push({
      type: "error",
      title: "Invalid username",
      description: "Use 3–16 characters (letters, numbers, underscore).",
      duration: 3000,
    });
    return;
  }
  if (isOffensive(clean)) {
    // on offensive
    push({
      type: "error",
      title: "Not allowed",
      description: "That username isn't permitted.",
      duration: 3000,
    });
    return;
  }

  // DEV path (if you kept the simple Usernames table for testing)
  if (import.meta.env.DEV) {
    const { error: insertErr } = await supabase
      .from("Usernames")
      .insert({ username: clean });

    if (insertErr?.code === "23505") {
      // on duplicate
      push({
        type: "error",
        title: "Username taken",
        description: "Please choose another.",
        duration: 3000,
      });
      return;
    }
    if (insertErr) {
      // on generic failure
      push({
        type: "error",
        title: "Couldn’t save username",
        description: "Try again in a moment.",
        duration: 3000,
      });
      console.error("Usernames insert error:", insertErr);
      return;
    }
  } else {
    // PROD path (Profiles table with device_id + UPSERT)
    const deviceId = (localStorage.getItem(LS_DEVICE_ID) ?? ensureDeviceId())!;

    const { data: existsProfiles, error: existsProfilesErr } = await supabase
      .from("Profiles")
      .select("username")
      .eq("username", clean)
      .limit(1);

    if (!existsProfilesErr && existsProfiles && existsProfiles.length > 0) {
      // on duplicate
      push({
        type: "error",
        title: "Username taken",
        description: "Please choose another.",
        duration: 3000,
      });
      return;
    }

    const { error: upsertErr } = await supabase
      .from("Profiles")
      .upsert({ device_id: deviceId, username: clean }, { onConflict: "device_id" });

    if (upsertErr?.code === "23505") {
      // on duplicate (race)
      push({
        type: "error",
        title: "Username taken",
        description: "Please choose another.",
        duration: 3000,
      });
      return;
    }
    if (upsertErr) {
      // on generic failure
      push({
        type: "error",
        title: "Couldn’t save username",
        description: "Try again in a moment.",
        duration: 3000,
      });
      console.error("Profiles upsert error:", upsertErr);
      return;
    }
  }

  // 5) Success → persist locally and close modal
  localStorage.setItem(LS_USERNAME, clean);
  setUsername(clean);
  setNeedsUsername(false);

  // on success
  push({
    type: "success",
    title: "Username saved",
    description: `Welcome, ${clean}!`,
    duration: 2200,
  });
};




  // Called by CanvasGrid ONLY after Supabase insert succeeds
  const handlePlaced = () => {
    const ts = Date.now();
    localStorage.setItem(LS_LAST_PLACED_AT, String(ts));
    setLastPlacedAt(ts);
    setMyPlaced((n) => n + 1);
  };

  return (
    <div className="font-sans bg-[#f9f9f9] min-h-screen flex flex-col">
      <Header />
      {import.meta.env.DEV && (
  <div className="mx-auto mt-2 w-full max-w-5xl px-4">
    <div className="flex flex-wrap gap-2 rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800">
      <span className="font-semibold">Dev tools:</span>
      <button
        onClick={resetUsername}
        className="rounded bg-white px-2 py-1 shadow border border-purple-200 hover:bg-purple-100"
      >
        Reset username
      </button>
      <button
        onClick={resetCooldown}
        className="rounded bg-white px-2 py-1 shadow border border-purple-200 hover:bg-purple-100"
      >
        Reset cooldown
      </button>
      <button
        onClick={resetDeviceId}
        className="rounded bg-white px-2 py-1 shadow border border-purple-200 hover:bg-purple-100"
      >
        Reset device id
      </button>
      <span className="ml-auto opacity-70">cooldown = {import.meta.env.DEV ? "30s" : "5m"}</span>
    </div>
  </div>
)}


{/* HERO: Revealed */}
<div className="mx-auto mt-3 w-full max-w-5xl px-4">
  <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="text-center sm:text-left">
        <div className="text-[13px] uppercase tracking-wide text-gray-500">Pixels revealed</div>
        <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">
          {nonWhite.toLocaleString()} <span className="text-gray-400">/ {totalCells.toLocaleString()}</span>
        </div>
      </div>

      {/* Optional tiny progress bar for flair */}
      <div className="w-full sm:w-1/2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, (nonWhite / totalCells) * 100)}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">
          {((nonWhite / totalCells) * 100).toFixed(1)}%
        </div>
      </div>
    </div>

    {/* Supporting chips */}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
        Your pixels: <span className="font-semibold">{myPlaced.toLocaleString()}</span>
      </div>
      <div
        className={`rounded-lg px-3 py-1.5 text-sm shadow-sm ${
          canPlace
            ? "border border-green-200 bg-green-50 text-green-700"
            : "border border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        Next pixel in: {canPlace ? "Ready" : formatTime(msRemaining)}
      </div>
    </div>
  </div>
</div>


      {/* Main content */}
      <main className="flex flex-col lg:flex-row flex-1 justify-center items-start gap-6 p-4">
        {/* LEFT: Canvas + Palette */}
        <div className="bg-white shadow-xl rounded-xl p-4 sm:p-6 border border-gray-200 w-full lg:max-w-[720px]">
{/* Zoom + username (compact pill) */}
<div className="mb-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 shadow-sm">
    <button
      onClick={zoomOut}
      className="h-8 w-8 rounded-full bg-white text-gray-700 shadow hover:bg-gray-100 active:scale-95"
      aria-label="Zoom out"
    >
      –
    </button>
    <span className="px-2 text-sm text-gray-700">Zoom: {zoom.toFixed(2)}x</span>
    <button
      onClick={zoomIn}
      className="h-8 w-8 rounded-full bg-white text-gray-700 shadow hover:bg-gray-100 active:scale-95"
      aria-label="Zoom in"
    >
      +
    </button>
  </div>

  {username && (
    <span className="sm:ml-auto text-sm text-gray-500">
      Signed in as <span className="font-semibold">{username}</span>
    </span>
  )}
</div>


          {/* Canvas + cooldown overlay (visual only; logic enforced in CanvasGrid) */}
          <div className="relative">
            {!canPlace && (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-white/60 backdrop-blur-[2px]">
                <div className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow">
                  Cooling down… {formatTime(msRemaining)}
                </div>
              </div>
            )}

            <div className={canPlace ? "" : "pointer-events-none"}>
              <CanvasGrid
                selectedColor={selectedColor}
                username={username ?? "Anonymous"}
                zoom={zoom}
                canPlace={canPlace}
                onPlaced={handlePlaced}
                onStats={({ nonWhite }) => setNonWhite(nonWhite)}
              />
            </div>
          </div>

          {/* Color palette */}
          <div className="mt-4 overflow-x-auto pb-2">
            <ColorPalette selectedColor={selectedColor} setSelectedColor={setSelectedColor} />
          </div>
        </div>

        {/* RIGHT: Leaderboard placeholder */}
        <div className="w-full lg:w-[260px]">
          <Leaderboard currentUsername={username ?? undefined} />


        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-gray-500 text-sm">
        <div>Made by JLStudios "guess__the_image"</div>
        <div className="mt-1 space-x-3">
          <a className="underline hover:text-gray-700" href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
          <a className="underline hover:text-gray-700" href="/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a className="underline hover:text-gray-700" href="/about.html" target="_blank" rel="noreferrer">About</a>
        </div>
      </footer>


      {/* Username Modal */}
      {needsUsername && <UsernameModal onSave={handleSaveUsername} />}
    </div>
  );
}

export default App;
