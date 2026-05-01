import { Agenda } from 'agenda';
import { env } from './env';

let agenda: Agenda | null = null;

export async function initAgenda(): Promise<Agenda> {
  agenda = new Agenda({
    db: {
      address: env.MONGODB_URI,
      collection: 'agendaJobs',
    },
    processEvery: '5 seconds',
    maxConcurrency: 3,
  });

  agenda.on('start', (job) => {
    console.log(`[Agenda] Job "${job.attrs.name}" starting — noticeId=${(job.attrs.data as Record<string, unknown>)?.noticeId}`);
  });

  agenda.on('complete', (job) => {
    console.log(`[Agenda] Job "${job.attrs.name}" completed — noticeId=${(job.attrs.data as Record<string, unknown>)?.noticeId}`);
  });

  agenda.on('fail', (err, job) => {
    console.error(`[Agenda] Job "${job.attrs.name}" failed — noticeId=${(job.attrs.data as Record<string, unknown>)?.noticeId}`, err);
  });

  await agenda.start();
  console.log('✅ Agenda.js job queue started');

  return agenda;
}

export function getAgenda(): Agenda {
  if (!agenda) {
    throw new Error('Agenda not initialized. Call initAgenda() first.');
  }
  return agenda;
}

export async function stopAgenda(): Promise<void> {
  if (agenda) {
    await agenda.stop();
    console.log('Agenda.js job queue stopped');
  }
}
