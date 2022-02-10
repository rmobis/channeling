import 'dotenv/config';
import { App } from '@slack/bolt';
import { updateTaskStatus, storeTask } from './db';
import { republishHomeView } from './util';

const REACTIONS_MAP: Record<string, string[]> = {
	ladybug: ['bug'],
};

const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true,
	port: Number(process.env.PORT) || 3000,
});

app.event('reaction_added', async ({ event }) => {
	if (event.item.type !== 'message') {
		return;
	}

	if (!Object.keys(REACTIONS_MAP).includes(event.reaction)) {
		return;
	}

	await storeTask({
		channel: event.item.channel,
		ts: event.item.ts,
		tags: REACTIONS_MAP[event.reaction],
	});

	await republishHomeView(event.user);
});

app.event('app_home_opened', async ({ event }) => {
	if (event.tab !== 'home') {
		return;
	}

	await republishHomeView(event.user);
});

app.action('update_task_status', async ({ ack, action, body }) => {
	if (action.type !== 'static_select') {
		return;
	}

	const [taskId, statusId] = action.selected_option.value.split(':');

	await updateTaskStatus(Number(taskId), Number(statusId));
	await ack();
	await republishHomeView(body.user.id);
});

(async () => {
	await app.start();

	console.log('⚡️ Channeling is running!');
})();

export default app;
