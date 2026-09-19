/* THE LIGHT PALETTE of the dossier maps, authored rather than read.

   The board has one theme and it is dark, so style.css carries no light tokens
   at all - and the deck, the PNG downloads and (since 2026-09-17) the screen
   itself are all light. There is nowhere to read this from, so it is written.

   Split out of dossier_map.js on 2026-09-17, when the heat and gains painters
   had to be registered there and the file was at its 500-line cap. It is the
   same object it was, moved whole; dossier_map.js still hands it out as
   DossierMap.palette("light"), which is what roads_map.js and the deck ask.

   NO ES modules - the page runs from file://. One global:

     window.DossierMapLight = { ...the palette... }

   Territory is told apart by lightness AND temperature - Houthi ground a warm
   grey, government a cool one, the sea a clear blue-grey - because three light
   tints can never sit 3:1 apart from one another; measured, houthi/sea 1.4:1,
   gov/sea 1.2:1. What does hold 3:1 is every line and mark on them: the
   darkened violet #5B4BC4 measures 6.5:1 on the land and 5.2:1 on the sea, the
   ink 12:1 and better. The fill under the violet stroke keeps the board's own
   #B7A5F7, so captured ground reads as the same colour in both decks. */
"use strict";

window.DossierMapLight = {
  /* Which palette this is, so a layer that authors its own colours (the zones'
     two in dossier_map_zones.js, the fighting scale in dossier_map_heat.js) can
     pick the set written for this ground instead of guessing from a token. */
  theme: "light",
  sea: "#C9DAEA", land: "#F4F7FA",
  houthi: "#C6BCAE", gov: "#E3E8ED", contested: "#EEF1F4",
  contestedStroke: "#7F8B98", frontMark: "#E01B0F",
  /* The governorate outline. SOLID grey, not a wash (2026-09-19): at 20% alpha
     it disappeared on the pale government fill and under the terrain, and Ziv
     asked to see it - "don't make them crazy, but make them seen". This grey
     measures 3.5:1 on the government fill and 2.3:1 on the Houthi one, against
     the country border's 9:1, so it reads on both sides and still sits below
     the border and the line of contact. */
  adm1: "#6E7B8A",
  border: "#33445A", borderW: 2, control: "#1F2D3D", controlW: 2, controlDash: "6 4",
  ink: "#14202C", muted: "#3A4A5A", faint: "#5A6876", govLabel: "#4A5A6A",
  halo: "rgba(255, 255, 255, 0.92)", violet: "#5B4BC4", violetFill: "#B7A5F7",
  lane: "#4A5A6A", box: "#FFFFFF", boxLine: "rgba(20, 40, 60, 0.30)"
};

/* ---- THE LEGEND'S OWN HEBREW WORDS ------------------------------------------

   A SECOND GLOBAL IN THIS FILE, and the reason is the reason the file exists:
   both are things the dossier maps paint that are AUTHORED rather than read
   from a token. They were in dossier_map.js beside the palette until
   2026-09-19, when the canvas text scale and the phone's numbers-only list map
   took that file to its 500-line cap. `DossierMap.words()` is the pass-through
   every caller still reads them through, and it is a FUNCTION because this
   file may load after dossier_map.js does.

     window.DossierMapWords = { ...the legend's Hebrew... }
   -------------------------------------------------------------------------- */
window.DossierMapWords = {
  houthi: "שטח בשליטת החות'ים",
  /* The government side's name and the fighting zone's name are Ziv's own
     words (2026-09-11), here and on the board's legend alike. */
  gov: "שטח בשליטת הכוחות הלגיטימיים",
  contested: "שטח לחימה פעיל",
  /* ONE row for every gain, confirmed or not (Ziv, 2026-09-11). Which ones an
     outside source confirmed is said in the text, never by a second style. */
  gained: "נכבש בידי החות'ים (מאומת + משוער)",
  front: "קו חזית משוער",
  lane: "נתיב שיט",
  /* The arrow row, and only on a map that carries arrows. It says ASSESSMENT
     in so many words: an arrow on a map reads as a reported movement unless
     the key says otherwise, and nothing here has happened yet. */
  axis: "ציר התקדמות אפשרי (הערכה)",
  /* The seam's row is this stem plus the date the gains start at, which
     dossier_map_legend.js reads off the data rather than off this line. */
  seam: "גבול השטח שנכבש מאז",
  noData: "אין נתוני מפה להצגה"
};
