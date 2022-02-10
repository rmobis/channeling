import { KnownBlock, HomeView, Block } from '@slack/bolt';
import { getTasks, Task } from './db';
import app from './index';

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
	const tagsMkdown = task.tags.map(tag => `\`${tag}\``).join(' ');

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
				type: 'button',
				style: 'primary',
				text: {
					type: 'plain_text',
					emoji: true,
					text: 'Complete'
				},
				value: 'click_me_123'
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
					text: `*Status:* _${task.status}_`
				},
				{
					type: 'mrkdwn',
					text: `*Tags:* ${tagsMkdown}`
				}
			]
		},
		{
			type: 'divider'
		}
	];
}
