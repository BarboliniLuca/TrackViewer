import assert from 'node:assert/strict';
import test from 'node:test';
import { Encoder, Profile } from '@garmin/fitsdk';

globalThis.window = {
  resolveFitDecoder(parser){
    globalThis.decodeFit = parser;
  }
};

const { parseFIT } = await import('../fit-decoder.js');

function makeFitFile(records){
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'garmin',
    product: 1,
    timeCreated: new Date('2026-01-01T10:00:00Z')
  });
  records.forEach((record, index) => {
    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(Date.UTC(2026, 0, 1, 10, 0, index)),
      positionLat: Math.round(record.lat * 0x80000000 / 180),
      positionLong: Math.round(record.lon * 0x80000000 / 180),
      altitude: record.ele,
      heartRate: record.heartRate
    });
  });
  const bytes = encoder.close();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test('decodes FIT records into map points', () => {
  const parsed = parseFIT(makeFitFile([
    { lat: 45, lon: 9, ele: 120, heartRate: 110 },
    { lat: 45.001, lon: 9.002, ele: 125, heartRate: 130 }
  ]), 'hike activity');

  assert.equal(parsed.name, 'hike activity');
  assert.equal(parsed.activity, 'Escursionismo');
  assert.equal(parsed.points.length, 2);
  assert.ok(Math.abs(parsed.points[0].lat - 45) < 0.00001);
  assert.ok(Math.abs(parsed.points[0].lon - 9) < 0.00001);
  assert.equal(parsed.points[0].ele, 120);
  assert.equal(parsed.points[0].heartRate, 110);
  assert.ok(parsed.points[0].time instanceof Date);
});

test('rejects data that is not a valid FIT file', () => {
  assert.equal(parseFIT(new ArrayBuffer(8), 'not-fit'), null);
});
