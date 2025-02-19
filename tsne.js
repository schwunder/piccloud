import TSNE from "tsne-js";
import { getEmbeddings, updateTsneProjections } from "./db.js";

const performTSNE = (data) => {
  const model = new TSNE();

  model.init({ data });
  model.run();
  return model.getOutputScaled(); // Returns only projection points
};

const main = async () => {
  const data = getEmbeddings();
  const projections = [];

  for (let i = 0; i < data.length; i += 100) {
    projections.push(
      ...performTSNE(
        data.slice(i, i + 100).map(({ embedding }) => [...embedding])
      )
    );
  }

  const projectedData = data.map((item, index) => ({
    id: item.id,
    filename: item.filename,
    projection: projections[index], // Map projection using index
  }));
  console.log(projectedData);
  console.log(updateTsneProjections(projectedData));
};

main();
