import { KnownBlock, HomeView, Block, PlainTextOption } from '@slack/bolt';
import { getStatuses, getTasks, Task } from './db';
import app from './index';

const STATUS_STYLING_MAP: Record<string, string> = {
	New: '_',
	Completed: '~'
};

export async function republishHomeView(user: string) {
	const tasks = await getTasks();
	const taskBlocks = await Promise.all(tasks.map(task => buildTaskBlocks(task)));

	const homeView: HomeView = {
		type: 'home',
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: 'Tasks',
				},
			},
			{
				type: 'divider'
			},
			...taskBlocks.flat()
		],
	};

	await app.client.views.publish({
		user_id: user,
		view: homeView,
	});
}

async function fetchTaskData(task: Task) {
	let message, profile;

	const msgRes = await app.client.conversations.history({
		channel: task.channel,
		latest: task.ts,
		inclusive: true,
		limit: 1,
	});

	if (msgRes.messages?.length === 1) {
		message = msgRes.messages[0];

		const profRes = await app.client.users.profile.get({
			user: message.user,
		});

		if (profRes.profile) {
			profile = profRes.profile;
		}
	}

	return { message, profile };
}

async function buildTaskBlocks(task: Task): Promise<(Block | KnownBlock)[]> {
	// fetching every single message/user every single time doesn't really sound like a good idea,
	// but the alternative would be to cache it in the database and then we have to deal with cache
	// invalidation and what not; we'll leave it for now.
	const { message, profile } = await fetchTaskData(task);

	const tagsMkdwn = task.tags.map(tag => `\`${tag}\``).join(' ');
	const statusStyling = STATUS_STYLING_MAP[task.status];
	const statusOptions = await buildStatusOptions(task);

	if (!message || !profile) {
		return [];
	}

	return [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${message.text}`
			},
			accessory: {
				type: 'static_select',
				placeholder: {
					type: 'plain_text',
					text: 'Choose new status...',
					emoji: true
				},
				action_id: 'update_task_status',
				options: statusOptions,
			}
		},
		{
			type: 'context',
			elements: [
				{
					type: 'image',
					image_url: profile.image_24 ?? '',
					alt_text: `${profile.display_name}`
				},
				{
					type: 'mrkdwn',
					text: ` *${profile.display_name}*`
				},
				{
					type: 'mrkdwn',
					text: `*Status:* ${statusStyling}${task.status}${statusStyling}`
				},
				{
					type: 'mrkdwn',
					text: `*Tags:* ${tagsMkdwn}`
				}
			]
		},
		{
			type: 'divider'
		}
	];
}

async function buildStatusOptions(task: Task): Promise<PlainTextOption[]> {
	// if this were real world code, we should probably cache this
	const statuses = await getStatuses();

	const withoutCurrent = statuses.filter(status => status.id !== task.status_id);

	return withoutCurrent.map(status => ({
		text: {
			type: 'plain_text',
			text: status.name,
			emoji: true
		},
		// this is kind of a hack because we need to pass two bits of info to the action; not sure
		// if there's a better way
		value: `${task.id}:${status.id}`
	}));
}
