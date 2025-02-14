import tsnejs from "tsne";
import { getEmbeddings } from "./db";

const runTSNE = (distances) => {
  const tsne = new tsnejs.tSNE();
  tsne.initDataDist(distances);

  for (let k = 0; k < 100; k++) {
    tsne.step();
  }

  return tsne.getSolution();
};

const main = () => {
  const data = getEmbeddings();
  const distances = data.map((item) => item.embedding);
  const firstHundred = distances.slice(0, 100);
  console.log("Coordinates:", runTSNE(distances));
};

main();
