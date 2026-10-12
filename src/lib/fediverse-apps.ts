/* Fediverse apps directory — source: https://fediverse.info/apps (scraped 2026-10-12).
   Static data: the source has no API and no CORS, so the list is embedded. */

export interface FediverseApp {
  name: string;
  category: string;
  description: string;
  website: string;
}

export const FEDIVERSE_APPS: readonly FediverseApp[] = [
  {
    name: "Akkoma",
    category: "Microblogging",
    description:
      "Akkoma is a faster-paced fork, it has a varied and potentially experimental feature set tailored specifically to the corner of the fediverse inhabited by the project creator and contributors.",
    website: "https://akkoma.dev/AkkomaGang/akkoma",
  },
  {
    name: "Bonfire",
    category: "Microblogging",
    description:
      "A federated social network for individuals and communities to design, operate and control their own digital lives.",
    website: "https://bonfirenetworks.org",
  },
  {
    name: "Cherrypick",
    category: "Microblogging",
    description: "Fork of Misskey.",
    website: "https://github.com/kokonect-link/cherrypick",
  },
  {
    name: "Fedibird",
    category: "Microblogging",
    description:
      "Fedibird is a fork of Mastodon arranged with features maintained by Takeshi Umeda (noellabo).",
    website: "https://github.com/fedibird/mastodon",
  },
  {
    name: "Foundkey",
    category: "Microblogging",
    description:
      "Forked from Misskey, FoundKey improves on maintainability and behaviour, while also bringing in useful features.",
    website: "https://akkoma.dev/FoundKeyGang/FoundKey",
  },
  {
    name: "Friendica",
    category: "Microblogging",
    description: "Friendica is a free and open-source software distributed social network.",
    website: "https://friendi.ca",
  },
  {
    name: "GNU social",
    category: "Microblogging",
    description: "The free/libre software social networking platform.",
    website: "https://gnusocial.network",
  },
  {
    name: "Gotosocial",
    category: "Microblogging",
    description: "GoToSocial is an ActivityPub social network server, written in Golang.",
    website: "https://gotosocial.org",
  },
  {
    name: "Hackers' Pub",
    category: "Microblogging",
    description: "ActivityPub-enabled social network for hackers.",
    website: "https://hackers.pub/",
  },
  {
    name: "Hollo",
    category: "Microblogging",
    description: "Hollo is a federated single-user microblogging software powered by Fedify.",
    website: "https://docs.hollo.social",
  },
  {
    name: "Hometown",
    category: "Microblogging",
    description:
      "A supported fork of Mastodon that provides local posting and a wider range of content types.",
    website: "https://github.com/hometown-fork/hometown",
  },
  {
    name: "Iceshrimp",
    category: "Microblogging",
    description:
      "YAMF (Yet another Misskey fork) bringing you no-nonsense fixes, features & improvements you actually want since 2023",
    website: "https://iceshrimp.dev/iceshrimp/iceshrimp",
  },
  {
    name: "Kmyblue",
    category: "Microblogging",
    description: "Mastodon, which specializes in small communities for the inner circle.",
    website: "https://github.com/kmycode/mastodon",
  },
  {
    name: "Ktistec",
    category: "Microblogging",
    description: "Single user ActivityPub server.",
    website: "https://github.com/toddsundsted/ktistec",
  },
  {
    name: "Mastodon",
    category: "Microblogging",
    description:
      "Mastodon is an open source decentralized social network - by the people for the people",
    website: "https://joinmastodon.org",
  },
  {
    name: "Meisskey",
    category: "Microblogging",
    description: "Meisskey is a decentralized microblogging platform, a fork of Misskey.",
    website: "https://github.com/mei23/misskey",
  },
  {
    name: "Microblogpub",
    category: "Microblogging",
    description: "A self-hosted, single-user, ActivityPub powered microblog.",
    website: "https://microblog.pub",
  },
  {
    name: "Microdotblog",
    category: "Microblogging",
    description: "Personal blogging that makes it easy to be social.",
    website: "https://micro.blog",
  },
  {
    name: "Misskey",
    category: "Microblogging",
    description: "An interplanetary microblogging platform.",
    website: "https://misskey-hub.net",
  },
  {
    name: "Mitra",
    category: "Microblogging",
    description: "Federated micro-blogging platform.",
    website: "https://codeberg.org/silverpill/mitra",
  },
  {
    name: "Pleroma",
    category: "Microblogging",
    description: "Free and Open Federated Microblogging server.",
    website: "https://pleroma.social",
  },
  {
    name: "Sharkey",
    category: "Microblogging",
    description:
      "Sharkey is an Misskey fork following upstream changes when possible, with added features.",
    website: "https://joinsharkey.org",
  },
  {
    name: "Smithereen",
    category: "Microblogging",
    description:
      "Federated, ActivityPub-compatible social network server with friends, walls, and groups.",
    website: "https://smithereen.software",
  },
  {
    name: "Snac",
    category: "Microblogging",
    description: "A simple, minimalistic ActivityPub instance written in portable C.",
    website: "https://codeberg.org/grunfink/snac2",
  },
  {
    name: "Takahe",
    category: "Microblogging",
    description: "An efficient ActivityPub Server, for small installs with multiple domains.",
    website: "https://jointakahe.org",
  },
  {
    name: "wafrn",
    category: "Microblogging",
    description: "Wafrn is a federated social media inspired by tumblr.",
    website: "https://wafrn.net",
  },
  {
    name: "Zap",
    category: "Microblogging",
    description: "A fediverse server.",
    website: "https://codeberg.org/zot-archive/zap",
  },
  {
    name: "Loops",
    category: "Video",
    description:
      "The federated short video sharing platform. Share, discover, and create short videos across the social web.",
    website: "https://joinloops.org",
  },
  {
    name: "Owncast",
    category: "Video",
    description:
      "Owncast is a free and open source live video and web chat server for use with existing popular broadcasting software.",
    website: "https://owncast.online",
  },
  {
    name: "PeerTube",
    category: "Video",
    description: "Free software to take back control of your videos",
    website: "https://joinpeertube.org",
  },
  {
    name: "frequency",
    category: "Image Sharing",
    description: "A mindful, federated social network to share your life with family and friends",
    website: "https://frequency.app",
  },
  {
    name: "Pixelfed",
    category: "Image Sharing",
    description: "Photo Sharing. For Everyone.",
    website: "https://pixelfed.org",
  },
  {
    name: "Vernissage",
    category: "Image Sharing",
    description:
      "Vernissage is a free platform designed for photographers. It's ad-free and focused on community and creativity, not algorithms.",
    website: "https://vernissage.photos/home",
  },
  {
    name: "bandwagon",
    category: "Audio",
    description: "An open community for bands and musicians",
    website: "https://bandwagon.fm/home",
  },
  {
    name: "Castopod",
    category: "Audio",
    description: "The free and open-source solution to your podcasting 2.0 journey.",
    website: "https://castopod.org",
  },
  {
    name: "Funkwhale",
    category: "Audio",
    description: "A social platform to enjoy and share music.",
    website: "https://funkwhale.audio",
  },
  {
    name: "Drupal",
    category: "Blogging",
    description:
      "Drupal is an open source content management platform powering millions of websites and applications",
    website: "https://www.drupal.org/project/activitypub",
  },
  {
    name: "Ecko",
    category: "Blogging",
    description: "Ecko is a fork of Mastodon with extra features requested by the community.",
    website: "https://magicstone.dev",
  },
  {
    name: "Ghost",
    category: "Blogging",
    description:
      "Ghost is a powerful app for professional publishers to create, share, and grow a business around their content.",
    website: "https://ghost.org",
  },
  {
    name: "Hubzilla",
    category: "Blogging",
    description:
      "Hubzilla is a powerful platform for creating interconnected websites featuring a decentralized identity, communications, and permissions framework built using common webserver technology.",
    website: "https://hubzilla.org",
  },
  {
    name: "Plume",
    category: "Blogging",
    description: "A federated blogging application",
    website: "https://joinplu.me",
  },
  {
    name: "Socialhome",
    category: "Blogging",
    description: "Federated personal profile with rich content.",
    website: "https://socialhome.network",
  },
  {
    name: "WordPress",
    category: "Blogging",
    description:
      "Open source software which you can use to easily create a beautiful website, blog, or app.",
    website: "https://wordpress.org",
  },
  {
    name: "Writefreely",
    category: "Blogging",
    description: "Minimalist, federated, self-hosted blogging platform.",
    website: "https://writefreely.org",
  },
  {
    name: "Gancio",
    category: "Events",
    description: "A shared agenda for local communities.",
    website: "https://gancio.org",
  },
  {
    name: "Mobilizon",
    category: "Events",
    description: "Mobilizon is an open source software for event planning and group management.",
    website: "https://joinmobilizon.org",
  },
  {
    name: "Brutalinks",
    category: "Forums",
    description: "Link aggregator inspired by reddit using ActivityPub federation.",
    website: "https://git.sr.ht/~mariusor/brutalinks",
  },
  {
    name: "Lemmy",
    category: "Forums",
    description: "A link aggregator and forum for the fediverse.",
    website: "https://join-lemmy.org",
  },
  {
    name: "Lotide",
    category: "Forums",
    description: "A federated forum / link aggregator using ActivityPub.",
    website: "https://git.sr.ht/~vpzom/lotide",
  },
  {
    name: "Mbin",
    category: "Forums",
    description: "Mbin a fork of kbin, community-focused.",
    website: "https://joinmbin.org/",
  },
  {
    name: "NodeBB",
    category: "Forums",
    description: "A better community platform for the modern web",
    website: "https://nodebb.org",
  },
  {
    name: "Piefed",
    category: "Forums",
    description:
      "An open source reddit-like federated forum that works well with Lemmy and others.",
    website: "https://join.piefed.social",
  },
  {
    name: "Forgejo",
    category: "Git",
    description:
      "Forgejo is a self-hosted lightweight software forge. Easy to install and low maintenance, it just does the job.",
    website: "https://forgejo.org/",
  },
  {
    name: "Gitea",
    category: "Git",
    description:
      "Gitea is a forge software package for hosting software development version control using Git.",
    website: "https://gitea.io",
  },
  {
    name: "Shoot",
    category: "Messaging",
    description:
      "Connect with your friends on Shoot or other federated services like Mastodon, Pixelfed, *key with direct messages, group chats, and guilds.",
    website: "https://github.com/maddyunderstars/shoot",
  },
  {
    name: "Activity-Relay",
    category: "Other",
    description: "Yet another powerful customizable ActivityPub relay server written in Go.",
    website: "https://relay.toot.yukimochi.jp",
  },
  {
    name: "Activityrelay",
    category: "Other",
    description: "Generic LitePub relay.",
    website: "https://git.pleroma.social/pleroma/relay",
  },
  {
    name: "appy",
    category: "Other",
    description:
      "A lightweight server implementing the ActivityPub protocol in Python over fastAPI.",
    website: "https://appy.cat",
  },
  {
    name: "BadgeFed",
    category: "Other",
    description:
      "Verifiable digital credentials for the Fediverse. Breaking free from badge silos.",
    website: "https://badgefed.org",
  },
  {
    name: "Betula",
    category: "Other",
    description:
      "Single-user federated bookmark manager with hypertext descriptions, tagging, local and federated search, archival and whatnot.",
    website: "https://betula.mycorrhiza.wiki",
  },
  {
    name: "Bookwyrm",
    category: "Other",
    description:
      "BookWyrm is a social network for tracking your reading, talking about books, writing reviews, and discovering what to read next.",
    website: "https://joinbookwyrm.com",
  },
  {
    name: "Bridgy-fed",
    category: "Other",
    description: "Bridgy Fed connects your web site to Mastodon and the fediverse.",
    website: "https://fed.brid.gy",
  },
  {
    name: "Emissary",
    category: "Other",
    description: "The Social Web Toolkit: AProgrammable server for custom Fediverse apps.",
    website: "https://emissary.dev",
  },
  {
    name: "Flipboard",
    category: "Other",
    description:
      "One place for all the stories you care about. Join the Flipboard community to discover and share what inspires you.",
    website: "https://flipboard.com",
  },
  {
    name: "flohmarkt",
    category: "Other",
    description: "federated decentral classified ad software using activitypub",
    website: "https://codeberg.org/flohmarkt/flohmarkt",
  },
  {
    name: "irwin",
    category: "Other",
    description: "an activitypub and indieauth server",
    website: "https://otisburg.social",
  },
  {
    name: "Loforo",
    category: "Other",
    description:
      "Loforo.com is a fast, friendly and free microblog service that supports ActivityPub and Mastodon.",
    website: "https://loforo.com",
  },
  {
    name: "Manyfold",
    category: "Other",
    description: "Organise and share your 3d print files.",
    website: "https://manyfold.app",
  },
  {
    name: "murlog",
    category: "Other",
    description: "A single-user ActivityPub microblog server.",
    website: "https://murlog.org",
  },
  {
    name: "NeoDB",
    category: "Other",
    description: "Review and share books, movies, music, games, and more",
    website: "https://neodb.net",
  },
  {
    name: "Postmarks",
    category: "Other",
    description: "Single-user bookmarking website designed to live on the Fediverse.",
    website: "https://postmarks.glitch.me",
  },
  {
    name: "stegodon",
    category: "Other",
    description:
      "SSH-first federated blogging platform. Users connect via SSH to create notes in a terminal interface that federate to the Fediverse via ActivityPub.",
    website: "https://stegodon.social",
  },
];

/** Category chips order (same as the source page). */
export const FEDIVERSE_CATEGORIES: readonly string[] = [
  "Microblogging",
  "Video",
  "Image Sharing",
  "Audio",
  "Blogging",
  "Events",
  "Forums",
  "Git",
  "Messaging",
  "Other",
];
