export type VehicleType = 'Four-wheeler' | 'Two-wheeler'

export interface ParkingSpot {
  seatId: string
  number: string
  tower: string
  level: string
  vehicleType: VehicleType
}

const fourWheelRows = [
  { tower: 'Tower 1', rows: [
    ['308', '110', '216', '431', '127A', '131', '170A', '180', '534', '529', '440'],
    ['309', '103', '217', '124A', '128', '131A', '176', '180A', '535', '530', ''],
    ['310', '101', '218', '125', '128A', '132', '176A', '181', '536', '531', ''],
    ['311', '102', '219', '125A', '129', '133', '177', '183A', '537', '444', ''],
    ['312', '103', '220', '126', '129A', '174', '177A', '214', '', '445', ''],
    ['', '104', '106', '128A', '130', '174A', '197', '214A', '527', '446', ''],
    ['', '105', '107', '127', '130A', '175', '197A', '215', '528', '447', ''],
  ] },
  { tower: 'Tower 5', rows: [
    ['1054', '1015', '1107', '1115', '1196A', '1192A', '1176', '1034', '1088', '', ''],
    ['1054A', '1016', '1108', '1191', '1195', '1177', '1034A', '1089', '', '', ''],
    ['1055', '1017', '1109', '1191A', '1195A', '1178', '1035', '1090', '', '', ''],
    ['1052', '1018', '1110', '1196', '1154', '1179', '1036', '1091', '', '', ''],
    ['1052A', '1019', '1111', '1196A', '1154A', '1180', '1037', '', '', '', ''],
    ['1053', '1020', '1112', '1197', '1153', '1181', '1038', '', '', '', ''],
    ['1053A', '1105', '1113', '1197A', '1153A', '1182', '1039', '', '', '', ''],
    ['1054', '1106', '1114', '1198', '1152', '1082', '1087', '', '', '', ''],
  ] },
]

const twoWheelRows = [
  { tower: 'Tower 1', rows: [['181A', '111', ''], ['182A', '112', ''], ['245A', '113', ''], ['246A', '114', ''], ['247A', '115', '']] },
  { tower: 'Tower 5', rows: [['1010', '1017', '101'], ['1011', '1074', '105'], ['1012', '1075', '106'], ['1013', '', '107'], ['1014', '', '108'], ['1015', '', '109']] },
]

function createSpots(
  groups: { tower: string; rows: string[][] }[],
  vehicleType: VehicleType,
): ParkingSpot[] {
  return groups.flatMap(({ tower, rows }) => rows.flatMap((row, rowIndex) =>
    row.flatMap((number, columnIndex) => {
      if (!number) return []
      const level = vehicleType === 'Four-wheeler'
        ? (columnIndex < 2 ? 'Ground' : columnIndex < 8 ? 'Basement 1' : 'Basement 2')
        : (columnIndex < 2 ? 'Basement 1' : 'Basement 2')
      return [{
        seatId: `${vehicleType}|${tower}|${level}|${rowIndex}|${columnIndex}|${number}`,
        number,
        tower,
        level,
        vehicleType,
      }]
    }),
  ))
}

export const PARKING_SPOTS = [
  ...createSpots(fourWheelRows, 'Four-wheeler'),
  ...createSpots(twoWheelRows, 'Two-wheeler'),
]
