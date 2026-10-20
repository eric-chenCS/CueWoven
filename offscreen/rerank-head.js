// The publisher's CLS -> Dense -> exact GELU -> LayerNorm -> Dense scoring head.
export function readHeadTensor(buffer, name, shape) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 8) throw Error('Invalid reranker tensor.');
  const headerLength = Number(new DataView(buffer).getBigUint64(0, true));
  if (!Number.isSafeInteger(headerLength) || headerLength < 2 || headerLength > 16384 || 8 + headerLength > buffer.byteLength) throw Error('Invalid tensor header.');
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength))), tensor = header[name];
  const count = shape.reduce((a, b) => a * b, 1), [start, end] = tensor?.data_offsets || [];
  if (tensor?.dtype !== 'F32' || JSON.stringify(tensor.shape) !== JSON.stringify(shape) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end - start !== count * 4 || 8 + headerLength + end > buffer.byteLength) throw Error('Unexpected reranker tensor shape.');
  const view = new DataView(buffer, 8 + headerLength + start, count * 4), values = new Float32Array(count);
  for (let i = 0; i < count; i++) {values[i] = view.getFloat32(i * 4, true); if (!Number.isFinite(values[i])) throw Error('Invalid reranker weights.');}
  return values;
}

// Numerical Recipes erf approximation, maximum error around 1.5e-7.
function erf(value) {
  const sign = value < 0 ? -1 : 1, x = Math.abs(value), t = 1 / (1 + 0.3275911 * x);
  return sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}

export function scoreHead(hidden, head) {
  const [batch, tokens, dim] = hidden.dims;
  if (hidden.dims.length !== 3 || dim !== 384 || batch < 1 || batch > 10 || tokens < 1 || tokens > 256 || hidden.data.length !== batch * tokens * dim) throw Error('Unexpected reranker output.');
  const scores = [];
  for (let b = 0; b < batch; b++) {
    const activated = new Float64Array(dim), offset = b * tokens * dim;
    let mean = 0, variance = 0;
    for (let j = 0; j < dim; j++) {
      let value = 0;
      for (let k = 0; k < dim; k++) value += hidden.data[offset + k] * head.dense[j * dim + k];
      activated[j] = 0.5 * value * (1 + erf(value / Math.SQRT2));
      mean += activated[j] / dim;
    }
    for (const value of activated) variance += (value - mean) ** 2 / dim;
    const scale = Math.sqrt(variance + 1e-5);
    let score = head.bias[0];
    for (let j = 0; j < dim; j++) score += ((activated[j] - mean) / scale * head.norm[j] + head.normBias[j]) * head.output[j];
    if (!Number.isFinite(score)) throw Error('Invalid reranker score.');
    scores.push(score);
  }
  return scores;
}
