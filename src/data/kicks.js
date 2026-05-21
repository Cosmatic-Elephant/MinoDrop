// SRS kick tables converted to board coordinates (y-down).
// Original SRS offsets use y-up, so dy signs are inverted here.
// Key format: '${fromState}->${toState}', states: 0=spawn, 1=CW, 2=180, 3=CCW

export const KICKS_JLSTZ = {
  '0->1': [[ 0, 0], [-1, 0], [-1,-1], [ 0, 2], [-1, 2]],
  '1->0': [[ 0, 0], [ 1, 0], [ 1, 1], [ 0,-2], [ 1,-2]],
  '1->2': [[ 0, 0], [ 1, 0], [ 1, 1], [ 0,-2], [ 1,-2]],
  '2->1': [[ 0, 0], [-1, 0], [-1,-1], [ 0, 2], [-1, 2]],
  '2->3': [[ 0, 0], [ 1, 0], [ 1,-1], [ 0, 2], [ 1, 2]],
  '3->2': [[ 0, 0], [-1, 0], [-1, 1], [ 0,-2], [-1,-2]],
  '3->0': [[ 0, 0], [-1, 0], [-1, 1], [ 0,-2], [-1,-2]],
  '0->3': [[ 0, 0], [ 1, 0], [ 1,-1], [ 0, 2], [ 1, 2]],
  '0->2': [[0, 0]],
  '2->0': [[0, 0]],
  '1->3': [[0, 0]],
  '3->1': [[0, 0]],
};

export const KICKS_I = {
  '0->1': [[ 0, 0], [-2, 0], [ 1, 0], [-2, 1], [ 1,-2]],
  '1->0': [[ 0, 0], [ 2, 0], [-1, 0], [ 2,-1], [-1, 2]],
  '1->2': [[ 0, 0], [-1, 0], [ 2, 0], [-1,-2], [ 2, 1]],
  '2->1': [[ 0, 0], [ 1, 0], [-2, 0], [ 1, 2], [-2,-1]],
  '2->3': [[ 0, 0], [ 2, 0], [-1, 0], [ 2,-1], [-1, 2]],
  '3->2': [[ 0, 0], [-2, 0], [ 1, 0], [-2, 1], [ 1,-2]],
  '3->0': [[ 0, 0], [ 1, 0], [-2, 0], [ 1, 2], [-2,-1]],
  '0->3': [[ 0, 0], [-1, 0], [ 2, 0], [-1,-2], [ 2, 1]],
  '0->2': [[0, 0]],
  '2->0': [[0, 0]],
  '1->3': [[0, 0]],
  '3->1': [[0, 0]],
};

// O piece: all transitions kick to [0,0] in SRS — rotates (rotState advances) but doesn't move.
// A custom rotation system can replace this entry with offsets that actually displace the piece.
export const KICKS_O = {
  '0->1': [[0, 0]], '1->0': [[0, 0]],
  '1->2': [[0, 0]], '2->1': [[0, 0]],
  '2->3': [[0, 0]], '3->2': [[0, 0]],
  '3->0': [[0, 0]], '0->3': [[0, 0]],
  '0->2': [[0, 0]], '2->0': [[0, 0]],
  '1->3': [[0, 0]], '3->1': [[0, 0]],
};

// Maps each piece type to its kick table.
// Custom piece types not listed here fall back to [[0,0]] (rotate in place, no kick).
export const KICK_TABLE_MAP = {
  J: KICKS_JLSTZ,
  L: KICKS_JLSTZ,
  S: KICKS_JLSTZ,
  T: KICKS_JLSTZ,
  Z: KICKS_JLSTZ,
  I: KICKS_I,
  O: KICKS_O,
};
