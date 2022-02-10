import {
	KnownBlock,
	HomeView,
	Block,
	PlainTextOption,
	ModalView,
} from '@slack/bolt';
import { fetchTaskData } from './util';
import { DefaultStatus, getStatus, Status, Task } from './db';
import { CustomAction } from './index';

const STATUS_STYLING_MAP: Record<string, string> = {
	New: '_',
	Completed: '~',
};

export async function buildHomeView(tasks: Task[]): Promise<HomeView> {
	const taskBlocks = await Promise.all(
		tasks.map((task) => buildTaskBlocks(task))
	);

	return {
		type: 'home',
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `Welcome to Channeling!`,
				},
				accessory: {
					type: 'overflow',
					options: [
						{
							text: {
								type: 'plain_text',
								text: 'Manage Status',
							},
							value: 'manage-status',
						},
					],
					action_id: CustomAction.MainOverflow,
				},
			},
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: 'Tasks',
				},
			},
			{
				type: 'divider',
			},
			...taskBlocks.flat(),
		],
	};
}

export async function buildStatusManagementView(): Promise<ModalView> {
	const status = await getStatus();
	const statusBlocks = await Promise.all(
		status.map((st) => buildStatusBlocks(st))
	);

	return {
		type: 'modal',
		title: {
			type: 'plain_text',
			text: 'Manage Status',
		},
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: 'Status List',
				},
			},
			{
				type: 'divider',
			},
			...statusBlocks,
			{
				type: 'divider',
			},
			{
				dispatch_action: true,
				type: 'input',
				element: {
					type: 'plain_text_input',
					action_id: CustomAction.AddStatus,
					focus_on_load: true,
				},
				label: {
					type: 'plain_text',
					text: 'Add Status',
				},
			},
		],
	};
}

async function buildTaskBlocks(task: Task): Promise<(Block | KnownBlock)[]> {
	// fetching every single message/user every single time doesn't really sound like a good idea,
	// but the alternative would be to cache it in the database and then we have to deal with cache
	// invalidation and what not; we'll leave it for now.
	const { message, profile } = await fetchTaskData(task);

	const tagsMkdwn = task.tags.map((tag) => `\`${tag}\``).join(' ');
	const statusStyling = STATUS_STYLING_MAP[task.status] ?? '';
	const statusOptions = await buildStatusOptions(task);

	if (!message || !profile) {
		return [];
	}

	return [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${message.text}`,
			},
			accessory: {
				type: 'static_select',
				placeholder: {
					type: 'plain_text',
					text: 'Choose new status...',
					emoji: true,
				},
				action_id: CustomAction.UpdateTaskStatus,
				options: statusOptions,
			},
		},
		{
			type: 'context',
			elements: [
				{
					type: 'image',
					image_url: profile.image_24 ?? '',
					alt_text: `${profile.display_name}`,
				},
				{
					type: 'mrkdwn',
					text: ` *${profile.display_name}*`,
				},
				{
					type: 'mrkdwn',
					text: `*Status:* ${statusStyling}${task.status}${statusStyling}`,
				},
				{
					type: 'mrkdwn',
					text: `*Tags:* ${tagsMkdwn}`,
				},
			],
		},
		{
			type: 'divider',
		},
	];
}

async function buildStatusOptions(task: Task): Promise<PlainTextOption[]> {
	// if this were real world code, we should probably cache this
	const statuses = await getStatus();

	const withoutCurrent = statuses.filter(
		(status) => status.id !== task.status_id
	);

	return withoutCurrent.map((status) => ({
		text: {
			type: 'plain_text',
			text: status.name,
		},
		// this is kind of a hack because we need to pass two bits of info to the action; not sure
		// if there's a better way
		value: `${task.id}:${status.id}`,
	}));
}

function buildStatusBlocks(status: Status): KnownBlock {
	const block: KnownBlock = {
		type: 'section',
		text: {
			type: 'mrkdwn',
			text: `*${status.name}*`,
		},
	};

	if (
		status.id !== DefaultStatus.New &&
		status.id !== DefaultStatus.Completed
	) {
		block.accessory = {
			type: 'button',
			text: {
				type: 'plain_text',
				text: ':x:',
			},
			value: status.id.toString(),
			action_id: CustomAction.DeleteStatus,
		};
	}

	return block;
}
