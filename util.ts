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

// fetching every single message/user every single time doesn't really sound like a good idea,
// but the alternative would be to cache it in the database and then we have to deal with cache
// invalidation and what not; we'll leave it for now.
async function buildTaskBlocks(task: Task): Promise<(Block | KnownBlock)[]> {
	const msgRes = await app.client.conversations.history({
		channel: task.channel,
		latest: task.ts,
		inclusive: true,
		limit: 1,
	});

	if (msgRes.messages?.length !== 1) {
		return [];
	}

	const msg = msgRes.messages[0];

	const profRes = await app.client.users.profile.get({
		user: msg.user,
	});

	if (!profRes.profile) {
		return [];
	}

	const prof = profRes.profile;

	const tagsMkdown = task.tags.map(tag => `\`${tag}\``).join(' ');

	return [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${msg.text}`
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
					image_url: prof.image_24 ?? '',
					alt_text: `${prof.display_name}`
				},
				{
					type: 'mrkdwn',
					text: ` *${prof.display_name}*`
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
