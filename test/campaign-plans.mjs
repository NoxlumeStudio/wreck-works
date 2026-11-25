const cut = (...ids) => ids.map(target => ({tool:'cut',target}))
const feet = cut('lower00','lower01','lower02')
const wide = [...feet,...cut('lower03')]
const more = (...extra) => [...feet,...extra]
const weight = target => ({tool:'weight',target})
const wire = (anchor,target) => ({tool:'wire',anchor,target})
const pad = target => ({tool:'pad',target})

export const plans = [
  more(...cut('upper01')),
  more(weight('b01')),
  cut('lower00','upper01','lower02','lower03','brace-base-0-1'),
  more(wire('g4','b10')),
  more(weight('b00')),
  more(wire('g4','b10')),
  more(...cut('seam2'),pad('g3')),
  more(...cut('upper00'),{tool:'jack',anchor:'g2',target:'b00'}),
  [...cut('lower00','upper01','lower02','lower03'),pad('g4')],
  [...wide,...cut('upper21')],
  [...wide,...cut('lower04'),wire('g0','b00')],
  more(wire('g2','b21')),
  cut('lower00','upper01','lower02','brace-base-0-0'),
  [...cut('lower00','upper01','lower02','lower03'),pad('g0')],
  [...cut('upper00','lower01','lower02','lower03'),wire('g3','b02')],
]
