/* Fediverse apps directory — source: https://fediverse.info/apps (scraped 2026-10-12).
   Static data: the source has no API and no CORS, so the list is embedded.
   `descriptionPt` was translated with Google gtx (same engine as the draft translator). */

export interface FediverseApp {
  name: string;
  category: string;
  description: string;
  descriptionPt: string;
  website: string;
}

export const FEDIVERSE_APPS: readonly FediverseApp[] = [
  {
    name: "Akkoma",
    category: "Microblogging",
    description:
      "Akkoma is a faster-paced fork, it has a varied and potentially experimental feature set tailored specifically to the corner of the fediverse inhabited by the project creator and contributors.",
    descriptionPt:
      "Akkoma é um fork de ritmo mais rápido, possui um conjunto de recursos variados e potencialmente experimentais, adaptados especificamente para o canto do fediverse habitado pelo criador e colaboradores do projeto.",
    website: "https://akkoma.dev/AkkomaGang/akkoma",
  },
  {
    name: "Bonfire",
    category: "Microblogging",
    description:
      "A federated social network for individuals and communities to design, operate and control their own digital lives.",
    descriptionPt:
      "Uma rede social federada para indivíduos e comunidades projetarem, operarem e controlarem suas próprias vidas digitais.",
    website: "https://bonfirenetworks.org",
  },
  {
    name: "Cherrypick",
    category: "Microblogging",
    description: "Fork of Misskey.",
    descriptionPt: "Garfo de Misskey.",
    website: "https://github.com/kokonect-link/cherrypick",
  },
  {
    name: "Fedibird",
    category: "Microblogging",
    description:
      "Fedibird is a fork of Mastodon arranged with features maintained by Takeshi Umeda (noellabo).",
    descriptionPt:
      "Fedibird é um fork do Mastodon organizado com recursos mantidos por Takeshi Umeda (noellabo).",
    website: "https://github.com/fedibird/mastodon",
  },
  {
    name: "Foundkey",
    category: "Microblogging",
    description:
      "Forked from Misskey, FoundKey improves on maintainability and behaviour, while also bringing in useful features.",
    descriptionPt:
      "Bifurcado do Misskey, o FoundKey melhora a capacidade de manutenção e o comportamento, ao mesmo tempo que traz recursos úteis.",
    website: "https://akkoma.dev/FoundKeyGang/FoundKey",
  },
  {
    name: "Friendica",
    category: "Microblogging",
    description: "Friendica is a free and open-source software distributed social network.",
    descriptionPt:
      "Friendica é uma rede social distribuída com software gratuito e de código aberto.",
    website: "https://friendi.ca",
  },
  {
    name: "GNU social",
    category: "Microblogging",
    description: "The free/libre software social networking platform.",
    descriptionPt: "A plataforma de rede social de software gratuito.",
    website: "https://gnusocial.network",
  },
  {
    name: "Gotosocial",
    category: "Microblogging",
    description: "GoToSocial is an ActivityPub social network server, written in Golang.",
    descriptionPt: "GoToSocial é um servidor de rede social ActivityPub, escrito em Golang.",
    website: "https://gotosocial.org",
  },
  {
    name: "Hackers' Pub",
    category: "Microblogging",
    description: "ActivityPub-enabled social network for hackers.",
    descriptionPt: "Rede social habilitada para ActivityPub para hackers.",
    website: "https://hackers.pub/",
  },
  {
    name: "Hollo",
    category: "Microblogging",
    description: "Hollo is a federated single-user microblogging software powered by Fedify.",
    descriptionPt:
      "Hollo é um software federado de microblog de usuário único desenvolvido pela Fedify.",
    website: "https://docs.hollo.social",
  },
  {
    name: "Hometown",
    category: "Microblogging",
    description:
      "A supported fork of Mastodon that provides local posting and a wider range of content types.",
    descriptionPt:
      "Um fork suportado do Mastodon que fornece postagem local e uma variedade mais ampla de tipos de conteúdo.",
    website: "https://github.com/hometown-fork/hometown",
  },
  {
    name: "Iceshrimp",
    category: "Microblogging",
    description:
      "YAMF (Yet another Misskey fork) bringing you no-nonsense fixes, features & improvements you actually want since 2023",
    descriptionPt:
      "YAMF (mais um fork Misskey) trazendo a você correções, recursos e melhorias práticas que você realmente deseja desde 2023",
    website: "https://iceshrimp.dev/iceshrimp/iceshrimp",
  },
  {
    name: "Kmyblue",
    category: "Microblogging",
    description: "Mastodon, which specializes in small communities for the inner circle.",
    descriptionPt: "Mastodon, especializada em pequenas comunidades para o círculo interno.",
    website: "https://github.com/kmycode/mastodon",
  },
  {
    name: "Ktistec",
    category: "Microblogging",
    description: "Single user ActivityPub server.",
    descriptionPt: "Servidor ActivityPub de usuário único.",
    website: "https://github.com/toddsundsted/ktistec",
  },
  {
    name: "Mastodon",
    category: "Microblogging",
    description:
      "Mastodon is an open source decentralized social network - by the people for the people",
    descriptionPt:
      "Mastodon é uma rede social descentralizada de código aberto - do povo para o povo",
    website: "https://joinmastodon.org",
  },
  {
    name: "Meisskey",
    category: "Microblogging",
    description: "Meisskey is a decentralized microblogging platform, a fork of Misskey.",
    descriptionPt:
      "Meisskey é uma plataforma de microblogging descentralizada, um fork do Misskey.",
    website: "https://github.com/mei23/misskey",
  },
  {
    name: "Microblogpub",
    category: "Microblogging",
    description: "A self-hosted, single-user, ActivityPub powered microblog.",
    descriptionPt: "Um microblog auto-hospedado e de usuário único desenvolvido pelo ActivityPub.",
    website: "https://microblog.pub",
  },
  {
    name: "Microdotblog",
    category: "Microblogging",
    description: "Personal blogging that makes it easy to be social.",
    descriptionPt: "Blog pessoal que torna mais fácil ser social.",
    website: "https://micro.blog",
  },
  {
    name: "Misskey",
    category: "Microblogging",
    description: "An interplanetary microblogging platform.",
    descriptionPt: "Uma plataforma de microblogging interplanetária.",
    website: "https://misskey-hub.net",
  },
  {
    name: "Mitra",
    category: "Microblogging",
    description: "Federated micro-blogging platform.",
    descriptionPt: "Plataforma federada de microblog.",
    website: "https://codeberg.org/silverpill/mitra",
  },
  {
    name: "Pleroma",
    category: "Microblogging",
    description: "Free and Open Federated Microblogging server.",
    descriptionPt: "Servidor de microblogging federado gratuito e aberto.",
    website: "https://pleroma.social",
  },
  {
    name: "Sharkey",
    category: "Microblogging",
    description:
      "Sharkey is an Misskey fork following upstream changes when possible, with added features.",
    descriptionPt:
      "Sharkey é um fork do Misskey que segue alterações upstream quando possível, com recursos adicionais.",
    website: "https://joinsharkey.org",
  },
  {
    name: "Smithereen",
    category: "Microblogging",
    description:
      "Federated, ActivityPub-compatible social network server with friends, walls, and groups.",
    descriptionPt:
      "Servidor de rede social federado compatível com ActivityPub com amigos, paredes e grupos.",
    website: "https://smithereen.software",
  },
  {
    name: "Snac",
    category: "Microblogging",
    description: "A simple, minimalistic ActivityPub instance written in portable C.",
    descriptionPt: "Uma instância simples e minimalista do ActivityPub escrita em C portátil.",
    website: "https://codeberg.org/grunfink/snac2",
  },
  {
    name: "Takahe",
    category: "Microblogging",
    description: "An efficient ActivityPub Server, for small installs with multiple domains.",
    descriptionPt:
      "Um servidor ActivityPub eficiente, para pequenas instalações com vários domínios.",
    website: "https://jointakahe.org",
  },
  {
    name: "wafrn",
    category: "Microblogging",
    description: "Wafrn is a federated social media inspired by tumblr.",
    descriptionPt: "Wafrn é uma mídia social federada inspirada no tumblr.",
    website: "https://wafrn.net",
  },
  {
    name: "Zap",
    category: "Microblogging",
    description: "A fediverse server.",
    descriptionPt: "Um servidor fediverso.",
    website: "https://codeberg.org/zot-archive/zap",
  },
  {
    name: "Loops",
    category: "Video",
    description:
      "The federated short video sharing platform. Share, discover, and create short videos across the social web.",
    descriptionPt:
      "A plataforma federada de compartilhamento de vídeos curtos. Compartilhe, descubra e crie vídeos curtos nas redes sociais.",
    website: "https://joinloops.org",
  },
  {
    name: "Owncast",
    category: "Video",
    description:
      "Owncast is a free and open source live video and web chat server for use with existing popular broadcasting software.",
    descriptionPt:
      "Owncast é um servidor de bate-papo na web e vídeo ao vivo gratuito e de código aberto para uso com software de transmissão popular existente.",
    website: "https://owncast.online",
  },
  {
    name: "PeerTube",
    category: "Video",
    description: "Free software to take back control of your videos",
    descriptionPt: "Software gratuito para retomar o controle de seus vídeos",
    website: "https://joinpeertube.org",
  },
  {
    name: "frequency",
    category: "Image Sharing",
    description: "A mindful, federated social network to share your life with family and friends",
    descriptionPt:
      "Uma rede social federada e consciente para compartilhar sua vida com familiares e amigos",
    website: "https://frequency.app",
  },
  {
    name: "Pixelfed",
    category: "Image Sharing",
    description: "Photo Sharing. For Everyone.",
    descriptionPt: "Compartilhamento de fotos. Para todos.",
    website: "https://pixelfed.org",
  },
  {
    name: "Vernissage",
    category: "Image Sharing",
    description:
      "Vernissage is a free platform designed for photographers. It's ad-free and focused on community and creativity, not algorithms.",
    descriptionPt:
      "Vernissage é uma plataforma gratuita desenvolvida para fotógrafos. É livre de anúncios e focado na comunidade e na criatividade, não em algoritmos.",
    website: "https://vernissage.photos/home",
  },
  {
    name: "bandwagon",
    category: "Audio",
    description: "An open community for bands and musicians",
    descriptionPt: "Uma comunidade aberta para bandas e músicos",
    website: "https://bandwagon.fm/home",
  },
  {
    name: "Castopod",
    category: "Audio",
    description: "The free and open-source solution to your podcasting 2.0 journey.",
    descriptionPt: "A solução gratuita e de código aberto para sua jornada de podcasting 2.0.",
    website: "https://castopod.org",
  },
  {
    name: "Funkwhale",
    category: "Audio",
    description: "A social platform to enjoy and share music.",
    descriptionPt: "Uma plataforma social para curtir e compartilhar música.",
    website: "https://funkwhale.audio",
  },
  {
    name: "Drupal",
    category: "Blogging",
    description:
      "Drupal is an open source content management platform powering millions of websites and applications",
    descriptionPt:
      "Drupal é uma plataforma de gerenciamento de conteúdo de código aberto que alimenta milhões de sites e aplicativos",
    website: "https://www.drupal.org/project/activitypub",
  },
  {
    name: "Ecko",
    category: "Blogging",
    description: "Ecko is a fork of Mastodon with extra features requested by the community.",
    descriptionPt: "Ecko é um fork do Mastodon com recursos extras solicitados pela comunidade.",
    website: "https://magicstone.dev",
  },
  {
    name: "Ghost",
    category: "Blogging",
    description:
      "Ghost is a powerful app for professional publishers to create, share, and grow a business around their content.",
    descriptionPt:
      "Ghost é um aplicativo poderoso para editores profissionais criarem, compartilharem e expandirem um negócio em torno de seu conteúdo.",
    website: "https://ghost.org",
  },
  {
    name: "Hubzilla",
    category: "Blogging",
    description:
      "Hubzilla is a powerful platform for creating interconnected websites featuring a decentralized identity, communications, and permissions framework built using common webserver technology.",
    descriptionPt:
      "Hubzilla é uma plataforma poderosa para a criação de sites interconectados com uma estrutura descentralizada de identidade, comunicações e permissões construída usando tecnologia comum de servidor da web.",
    website: "https://hubzilla.org",
  },
  {
    name: "Plume",
    category: "Blogging",
    description: "A federated blogging application",
    descriptionPt: "Um aplicativo de blog federado",
    website: "https://joinplu.me",
  },
  {
    name: "Socialhome",
    category: "Blogging",
    description: "Federated personal profile with rich content.",
    descriptionPt: "Perfil pessoal federado com conteúdo rico.",
    website: "https://socialhome.network",
  },
  {
    name: "WordPress",
    category: "Blogging",
    description:
      "Open source software which you can use to easily create a beautiful website, blog, or app.",
    descriptionPt:
      "Software de código aberto que você pode usar para criar facilmente um lindo site, blog ou aplicativo.",
    website: "https://wordpress.org",
  },
  {
    name: "Writefreely",
    category: "Blogging",
    description: "Minimalist, federated, self-hosted blogging platform.",
    descriptionPt: "Plataforma de blog minimalista, federada e auto-hospedada.",
    website: "https://writefreely.org",
  },
  {
    name: "Gancio",
    category: "Events",
    description: "A shared agenda for local communities.",
    descriptionPt: "Uma agenda partilhada para as comunidades locais.",
    website: "https://gancio.org",
  },
  {
    name: "Mobilizon",
    category: "Events",
    description: "Mobilizon is an open source software for event planning and group management.",
    descriptionPt:
      "Mobilizon é um software de código aberto para planejamento de eventos e gerenciamento de grupos.",
    website: "https://joinmobilizon.org",
  },
  {
    name: "Brutalinks",
    category: "Forums",
    description: "Link aggregator inspired by reddit using ActivityPub federation.",
    descriptionPt: "Agregador de links inspirado no reddit usando a federação ActivityPub.",
    website: "https://git.sr.ht/~mariusor/brutalinks",
  },
  {
    name: "Lemmy",
    category: "Forums",
    description: "A link aggregator and forum for the fediverse.",
    descriptionPt: "Um agregador de links e fórum para o fediverse.",
    website: "https://join-lemmy.org",
  },
  {
    name: "Lotide",
    category: "Forums",
    description: "A federated forum / link aggregator using ActivityPub.",
    descriptionPt: "Um fórum federado/agregador de links usando ActivityPub.",
    website: "https://git.sr.ht/~vpzom/lotide",
  },
  {
    name: "Mbin",
    category: "Forums",
    description: "Mbin a fork of kbin, community-focused.",
    descriptionPt: "Mbin, um fork de kbin, focado na comunidade.",
    website: "https://joinmbin.org/",
  },
  {
    name: "NodeBB",
    category: "Forums",
    description: "A better community platform for the modern web",
    descriptionPt: "Uma plataforma de comunidade melhor para a web moderna",
    website: "https://nodebb.org",
  },
  {
    name: "Piefed",
    category: "Forums",
    description:
      "An open source reddit-like federated forum that works well with Lemmy and others.",
    descriptionPt:
      "Um fórum federado de código aberto semelhante ao Reddit que funciona bem com Lemmy e outros.",
    website: "https://join.piefed.social",
  },
  {
    name: "Forgejo",
    category: "Git",
    description:
      "Forgejo is a self-hosted lightweight software forge. Easy to install and low maintenance, it just does the job.",
    descriptionPt:
      "Forgejo é uma forja de software leve e auto-hospedada. Fácil de instalar e de baixa manutenção, ele simplesmente faz o trabalho.",
    website: "https://forgejo.org/",
  },
  {
    name: "Gitea",
    category: "Git",
    description:
      "Gitea is a forge software package for hosting software development version control using Git.",
    descriptionPt:
      "Gitea é um pacote de software forge para hospedar controle de versão de desenvolvimento de software usando Git.",
    website: "https://gitea.io",
  },
  {
    name: "Shoot",
    category: "Messaging",
    description:
      "Connect with your friends on Shoot or other federated services like Mastodon, Pixelfed, *key with direct messages, group chats, and guilds.",
    descriptionPt:
      "Conecte-se com seus amigos no Shoot ou outros serviços federados como Mastodon, Pixelfed, *key com mensagens diretas, bate-papos em grupo e guildas.",
    website: "https://github.com/maddyunderstars/shoot",
  },
  {
    name: "Activity-Relay",
    category: "Other",
    description: "Yet another powerful customizable ActivityPub relay server written in Go.",
    descriptionPt:
      "Mais um poderoso servidor de retransmissão ActivityPub personalizável escrito em Go.",
    website: "https://relay.toot.yukimochi.jp",
  },
  {
    name: "Activityrelay",
    category: "Other",
    description: "Generic LitePub relay.",
    descriptionPt: "Relé LitePub genérico.",
    website: "https://git.pleroma.social/pleroma/relay",
  },
  {
    name: "appy",
    category: "Other",
    description:
      "A lightweight server implementing the ActivityPub protocol in Python over fastAPI.",
    descriptionPt:
      "Um servidor leve que implementa o protocolo ActivityPub em Python sobre fastAPI.",
    website: "https://appy.cat",
  },
  {
    name: "BadgeFed",
    category: "Other",
    description:
      "Verifiable digital credentials for the Fediverse. Breaking free from badge silos.",
    descriptionPt:
      "Credenciais digitais verificáveis ​​para o Fediverse. Libertando-se dos silos de distintivos.",
    website: "https://badgefed.org",
  },
  {
    name: "Betula",
    category: "Other",
    description:
      "Single-user federated bookmark manager with hypertext descriptions, tagging, local and federated search, archival and whatnot.",
    descriptionPt:
      "Gerenciador de favoritos federado de usuário único com descrições de hipertexto, marcação, pesquisa local e federada, arquivamento e outros enfeites.",
    website: "https://betula.mycorrhiza.wiki",
  },
  {
    name: "Bookwyrm",
    category: "Other",
    description:
      "BookWyrm is a social network for tracking your reading, talking about books, writing reviews, and discovering what to read next.",
    descriptionPt:
      "BookWyrm é uma rede social para monitorar sua leitura, falar sobre livros, escrever resenhas e descobrir o que ler a seguir.",
    website: "https://joinbookwyrm.com",
  },
  {
    name: "Bridgy-fed",
    category: "Other",
    description: "Bridgy Fed connects your web site to Mastodon and the fediverse.",
    descriptionPt: "Bridgy Fed conecta seu site ao Mastodon e ao fediverse.",
    website: "https://fed.brid.gy",
  },
  {
    name: "Emissary",
    category: "Other",
    description: "The Social Web Toolkit: AProgrammable server for custom Fediverse apps.",
    descriptionPt:
      "The Social Web Toolkit: Um servidor programável para aplicativos Fediverse personalizados.",
    website: "https://emissary.dev",
  },
  {
    name: "Flipboard",
    category: "Other",
    description:
      "One place for all the stories you care about. Join the Flipboard community to discover and share what inspires you.",
    descriptionPt:
      "Um lugar para todas as histórias que lhe interessam. Junte-se à comunidade Flipboard para descobrir e compartilhar o que te inspira.",
    website: "https://flipboard.com",
  },
  {
    name: "flohmarkt",
    category: "Other",
    description: "federated decentral classified ad software using activitypub",
    descriptionPt:
      "software de anúncios classificados descentralizados federados usando atividadepub",
    website: "https://codeberg.org/flohmarkt/flohmarkt",
  },
  {
    name: "irwin",
    category: "Other",
    description: "an activitypub and indieauth server",
    descriptionPt: "um servidor Activitypub e indieauth",
    website: "https://otisburg.social",
  },
  {
    name: "Loforo",
    category: "Other",
    description:
      "Loforo.com is a fast, friendly and free microblog service that supports ActivityPub and Mastodon.",
    descriptionPt:
      "Loforo.com é um serviço de microblog rápido, amigável e gratuito que suporta ActivityPub e Mastodon.",
    website: "https://loforo.com",
  },
  {
    name: "Manyfold",
    category: "Other",
    description: "Organise and share your 3d print files.",
    descriptionPt: "Organize e compartilhe seus arquivos de impressão 3D.",
    website: "https://manyfold.app",
  },
  {
    name: "murlog",
    category: "Other",
    description: "A single-user ActivityPub microblog server.",
    descriptionPt: "Um servidor de microblog ActivityPub de usuário único.",
    website: "https://murlog.org",
  },
  {
    name: "NeoDB",
    category: "Other",
    description: "Review and share books, movies, music, games, and more",
    descriptionPt: "Revise e compartilhe livros, filmes, músicas, jogos e muito mais",
    website: "https://neodb.net",
  },
  {
    name: "Postmarks",
    category: "Other",
    description: "Single-user bookmarking website designed to live on the Fediverse.",
    descriptionPt: "Site de bookmarking de usuário único projetado para residir no Fediverse.",
    website: "https://postmarks.glitch.me",
  },
  {
    name: "stegodon",
    category: "Other",
    description:
      "SSH-first federated blogging platform. Users connect via SSH to create notes in a terminal interface that federate to the Fediverse via ActivityPub.",
    descriptionPt:
      "Primeira plataforma de blog federada com SSH. Os usuários se conectam via SSH para criar notas em uma interface de terminal que é federada ao Fediverse via ActivityPub.",
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
