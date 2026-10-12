/**
 * Dev-only script: accept every pending collaboration request sent to the
 * dummy creator from create-dummy-creator.js (who can't log in to accept it
 * himself). Goes through respondToCollaboration, the same path as the app's
 * Accept button, so the conversation is created and the sender gets the
 * "Collaboration Accepted!" push.
 * Run: node scripts/accept-dummy-creator-collabs.js
 */
require('dotenv').config();
const { prisma } = require('../src/config/db');
const { respondToCollaboration } = require('../src/modules/collaborations/collaboration.service');

async function main() {
  const creator = await prisma.user.findFirst({ where: { mobileNumber: '7775552221', role: 'CREATOR' } });
  if (!creator) throw new Error('Dummy creator not found — run scripts/create-dummy-creator.js first');

  const pending = await prisma.collaboration.findMany({
    where: { receiverId: creator.id, status: 'PENDING' },
    select: { id: true, senderId: true },
  });
  if (pending.length === 0) {
    console.log('No pending collaboration requests for the dummy creator.');
    return;
  }

  for (const collab of pending) {
    await respondToCollaboration(creator.id, collab.id, 'ACCEPT');
    console.log(`[collab] Accepted ${collab.id} from sender ${collab.senderId}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
