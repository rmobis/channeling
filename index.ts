import 'dotenv/config';
import { App } from '@slack/bolt';
import { updateTaskStatus, createTaskOrUpdateTags, createStatus, deleteStatus } from './db';
import { republishHomeView, showModal } from './util';

const REACTIONS_MAP: Record<string, string[]> = {
	ladybug: ['bug', 'qa'],
	eyes: ['needs-review'],
	mega: ['urgent']
};

export enum CustomAction {
	UpdateTaskStatus = 'update-task-status',
	DeleteStatus = 'delete-status',
	MainOverflow = 'main-overflow',
	AddStatus = 'add-status'
}

const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true,
	port: Number(process.env.PORT) || 3000,
});

app.event(/reaction_(added|removed)/, async ({ event }) => {
	if (event.type !== 'reaction_added' && event.type !== 'reaction_removed') {
		return;
	}

	if (event.item.type !== 'message') {
		return;
	}

	if (!Object.keys(REACTIONS_MAP).includes(event.reaction)) {
		return;
	}

	await createTaskOrUpdateTags({
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

app.action(CustomAction.UpdateTaskStatus, async ({ ack, action, body }) => {
	if (action.type !== 'static_select') {
		return;
	}

	const [taskId, statusId] = action.selected_option.value.split(':');

	await updateTaskStatus(Number(taskId), Number(statusId));
	await ack();

	await republishHomeView(body.user.id);
});

app.action(CustomAction.MainOverflow, async ({ ack, body }) => {
	if (body.type !== 'block_actions') {
		return;
	}

	await ack();
	await showModal({ triggerId: body.trigger_id });
});

app.action(CustomAction.AddStatus, async ({ ack, action, body }) => {
	if (action.type !== 'plain_text_input') {
		return;
	}

	if (body.type !== 'block_actions') {
		return;
	}

	if (!body.view) {
		return;
	}

	await ack();
	await createStatus(action.value);

	await showModal({ viewId: body.view.id });
	await republishHomeView(body.user.id);
});

app.action(CustomAction.DeleteStatus, async ({ ack, action, body }) => {
	if (action.type !== 'button') {
		return;
	}

	if (body.type !== 'block_actions') {
		return;
	}

	if (!body.view) {
		return;
	}

	await ack();
	await deleteStatus(Number(action.value));

	await showModal({ viewId: body.view.id });
	await republishHomeView(body.user.id);
});

(async () => {
	await app.start();

	await republishHomeView('U26DB2A2W');

	console.log('?????? Channeling is running!');
})();

export default app;
