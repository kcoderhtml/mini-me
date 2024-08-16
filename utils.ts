export function parseCSV(data: string[][]) {
  let parsed = "";

  // take each array as a column and each array within it as a rows in that column
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[0].length; j++) {
      parsed +=
        '"' + data[i][j].replaceAll('"', '""').replaceAll("\n", "\\n") + '",';
    }
    parsed += "\n";
  }

  return parsed;
}
