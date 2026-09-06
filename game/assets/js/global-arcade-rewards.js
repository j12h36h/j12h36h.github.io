import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const functions = getFunctions(getApp('site-account'));
const claimCall = httpsCallable(functions, 'claimGlobalArcadeMilestones');

export async function claimGlobalArcadeMilestones(gameId) {
  const result = await claimCall({ gameId:String(gameId || '') });
  const data = result?.data || {};
  if (!data.ok) throw new Error(data.error || 'Global milestone reward check failed.');
  return data;
}

export function milestoneRewardMessage(data, noun='SCORE') {
  const awarded = Math.max(0, Math.floor(Number(data?.creditsAwarded) || 0));
  const level = Math.max(0, Math.floor(Number(data?.milestoneLevel) || 0));
  const reached = Math.max(0, Math.floor(Number(data?.milestoneScore) || 0));
  const next = Math.max(0, Math.floor(Number(data?.nextMilestoneScore) || 0));
  const nextReward = Math.max(1, Math.floor(Number(data?.nextMilestoneReward) || (level + 1)));
  if (!awarded) return '';
  return `${noun} MILESTONES THROUGH ${reached.toLocaleString()} // +${awarded} CREDIT${awarded===1?'':'S'} // NEXT ${next.toLocaleString()} = +${nextReward}`;
}
