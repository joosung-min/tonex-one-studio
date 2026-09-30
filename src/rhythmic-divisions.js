// Wire order verified against Builty/TonexOneController's Mod/Delay dropdowns.
export const rhythmicDivisions=[
 '1/32 — Thirty-second note','1/32 dotted — Dotted thirty-second','1/32 triplet — Thirty-second triplet',
 '1/16 — Sixteenth note','1/16 dotted — Dotted sixteenth','1/16 triplet — Sixteenth triplet',
 '1/8 — Eighth note','1/8 dotted — Dotted eighth','1/8 triplet — Eighth triplet',
 '1/4 — Quarter note','1/4 dotted — Dotted quarter','1/4 triplet — Quarter triplet',
 '1/2 — Half note','1/2 dotted — Dotted half','1/2 triplet — Half triplet',
 '1/1 — Whole note','1/1 dotted — Dotted whole','1/1 triplet — Whole triplet'
].map((label,value)=>({label,value}));

export const divisionButtons=[
 {label:'1/4D',value:10},{label:'1/4',value:9},{label:'1/8D',value:7},{label:'1/8',value:6},{label:'1/16',value:3}
];
