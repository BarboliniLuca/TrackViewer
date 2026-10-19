import { Decoder, Stream } from '@garmin/fitsdk';

const SEMICIRCLE_TO_DEGREES = 180 / 0x80000000;

function detectActivity(messages, filename){
  const activity = [
    ...(messages.sessionMesgs || []).flatMap(session => [session.sport, session.subSport]),
    ...(messages.sportMesgs || []).flatMap(sport => [sport.sport, sport.subSport])
  ].filter(Boolean).join(' ').toLowerCase();
  const candidates = `${activity} ${filename || ''}`.toLowerCase();

  if (/cycling|biking|bike|mountain_biking/.test(candidates)) return 'Ciclismo';
  if (/running|run|jog/.test(candidates)) return 'Corsa';
  if (/hike|hiking|walking|walk|trek|trail|cammin|escursion/.test(candidates)) return 'Escursionismo';
  return 'Altro';
}

export function parseFIT(data, fallbackName){
  const stream = Stream.fromArrayBuffer(data);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT() || !decoder.checkIntegrity()) return null;

  const { messages, errors } = decoder.read();
  if (errors.length) return null;

  const points = (messages.recordMesgs || []).flatMap(record => {
    if (!Number.isFinite(record.positionLat) || !Number.isFinite(record.positionLong)) return [];
    const lat = record.positionLat * SEMICIRCLE_TO_DEGREES;
    const lon = record.positionLong * SEMICIRCLE_TO_DEGREES;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return [];

    return [{
      lat,
      lon,
      ele: Number.isFinite(record.altitude) ? record.altitude : null,
      time: record.timestamp instanceof Date ? record.timestamp : null,
      heartRate: Number.isFinite(record.heartRate) ? record.heartRate : null
    }];
  });
  if (!points.length) return null;

  return {
    name: fallbackName,
    points,
    activity: detectActivity(messages, fallbackName)
  };
}

window.resolveFitDecoder(parseFIT);
