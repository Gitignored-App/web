import React from 'react';

import { useRouter } from 'next/router';

import iwanthue from 'iwanthue';

import JSZip from 'jszip';

import { saveAs } from 'file-saver';

import Select from 'react-select';

import {
	Box,
	Button,
	ButtonGroup,
	Container,
	Divider,
	Grid,
	GridItem,
	Skeleton,
	Text,
} from '@chakra-ui/react';

import styled from '@emotion/styled';

import { parse, object, array, string, transform, nullable } from 'valibot';

import localForage from 'localforage';

import Fuse from 'fuse.js';

import {
	type DeepReadonly,
	Optional,
	formQueryParamStringFromRecord,
	Defined,
} from '@poolofdeath20/util';

import { ToastContainer, toast } from 'react-toastify';

import 'react-toastify/dist/ReactToastify.min.css';

import Layout from '../../src/web/components/layout';

import trpcClient from '../../src/web/proxy/client';
import { type Templates } from '../../src/api/database/persistence/template';
import {
	combineTemplates,
	generateContrastingColor,
} from '../../src/web/util/generator';
import { singleFlowParser } from '../../src/common/parser';

type Template = Templates[number];

const schemas = {
	names: string(),
	cacheOrdinaryTemplates: transform(
		nullable(
			array(
				object({
					name: string(),
					content: string(),
				})
			)
		),
		Optional.from
	),
	selectedOrdinaryTemplatesId: array(
		object({
			value: string(),
		})
	),
};

const StyledSelect = styled(Select)`
	width: 700px;
	> div > div {
		padding: 4px 8px;
	}
	@media (max-width: 808px) {
		width: 600px;
	}
	@media (max-width: 672px) {
		width: 500px;
	}
`;

const useCopyToClipboard = () => {
	const [copied, setCopied] = React.useState(false);

	React.useEffect(() => {
		if (!copied) {
			return;
		}

		const timeOut = setTimeout(() => {
			setCopied(false);
		}, 1000 * 2);

		return () => {
			clearTimeout(timeOut);
		};
	}, [copied]);

	return {
		copied,
		copy: (text: string) => {
			if (navigator?.clipboard?.writeText) {
				setCopied(true);

				navigator.clipboard.writeText(text);
			} else {
				const element = document.createElement('textarea');

				element.value = text;

				element.setAttribute('readonly', '');

				element.style.position = 'absolute';

				element.style.left = '-9999px';

				document.body.appendChild(element);

				element.select();

				document.execCommand('copy');

				document.body.removeChild(element);

				setCopied(true);
			}
		},
	};
};

const TemplatePreview = (
	props: Readonly<
		{
			backgroundColor: string;
		} & (
			| {
					type: 'ready';
					template: Template;
			  }
			| { type: 'loading'; name: Template['name'] }
		)
	>
) => {
	const clipboard = useCopyToClipboard();

	return (
		<Box
			p={4}
			width="100vw"
			maxWidth="100%"
			height="100%"
			borderRadius={4}
			backgroundColor="gray.100"
			display="flex"
			boxSizing="border-box"
			flexDirection="column"
			gridGap={4}
		>
			<Box
				display="flex"
				justifyContent="space-between"
				alignItems="center"
			>
				<Box
					py={2}
					px={4}
					fontSize="small"
					boxSizing="border-box"
					borderRadius={4}
					width="fit-content"
					backgroundColor={props.backgroundColor}
					color={generateContrastingColor(props.backgroundColor)}
				>
					<Text>
						{props.type === 'loading'
							? props.name
							: props.template.name}
					</Text>
				</Box>
				<Button
					fontSize="small"
					boxSizing="border-box"
					borderRadius={4}
					variant="solid"
					isDisabled={props.type === 'loading'}
					backgroundColor="#282A36"
					color="#FFF"
					_hover={{
						color: '#FFF',
						backgroundColor: '#282A36',
					}}
					onClick={() => {
						if (props.type === 'loading') {
							throw new Error(`Cannot click when it's loading`);
						}

						clipboard.copy(props.template.content);
					}}
				>
					{!clipboard.copied ? 'Copy' : '🎉 Copied'}
				</Button>
			</Box>
			<Box>
				{props.type === 'loading' ? (
					<Skeleton height="450px" minWidth="100%" />
				) : (
					<Text
						height="450px"
						fontSize="x-small"
						whiteSpace="pre-wrap"
						overflow="auto"
					>
						{props.template.content}
					</Text>
				)}
			</Box>
		</Box>
	);
};

const TemplatesPreview = (
	props: DeepReadonly<
		| {
				type: 'done';
				templates: Templates;
		  }
		| {
				type: 'loading';
				templatesName: Templates[0]['name'][];
		  }
	>
) => {
	const colorCount =
		props.type === 'done'
			? props.templates.length
			: props.templatesName.length;

	const palette = React.useMemo(() => {
		return iwanthue(Math.max(2, colorCount));
	}, [colorCount]);

	const paletteAt = (index: number) => {
		return Defined.parse(palette.at(index)).orThrow(
			new Error(`There is no palette at index of ${index}`)
		);
	};

	return (
		<Grid
			gap={6}
			width="100%"
			autoRows="1fr"
			templateColumns="repeat(3, minmax(0, 1fr))"
		>
			{props.type === 'loading'
				? props.templatesName.map((name, index) => {
						return (
							<GridItem key={name} width="100%">
								<TemplatePreview
									type="loading"
									name={name}
									backgroundColor={paletteAt(index)}
								/>
							</GridItem>
						);
					})
				: props.templates.map((template, index) => {
						return (
							<GridItem key={template.name} width="100%">
								<TemplatePreview
									type="ready"
									template={template}
									backgroundColor={paletteAt(index)}
								/>
							</GridItem>
						);
					})}
		</Grid>
	);
};

class TemplatesCache {
	constructor(
		private readonly keys: Readonly<{
			templates: string;
		}>
	) {}

	readonly updateTemplates = async (
		props: ReturnType<typeof useNotification>['updateState']
	) => {
		const templates = await this.getOptionalTemplates();

		return templates.match({
			none: this.setAndGetTemplates(props),
			some: async () => {
				return trpcClient.templateBatch.shouldUpdate
					.query()
					.then(async (result) => {
						const func =
							result.hadSucceed && result.data
								? this.setAndGetTemplates(props)
								: this.getTemplates;

						return func();
					});
			},
		});
	};

	private readonly setAndGetTemplates = (
		props: ReturnType<typeof useNotification>['updateState']
	) => {
		return async () => {
			props.loading();

			return trpcClient.template.findAllTemplates
				.query()
				.then((result) => {
					if (!result.hadSucceed) {
						props.failed();
					} else {
						props.succeed();
						this.setTemplates(result.data);
					}

					return result;
				});
		};
	};

	private readonly setTemplates = async (templates: Templates) => {
		return localForage.setItem(this.keys.templates, templates);
	};

	private readonly getTemplates = async () => {
		return this.getOptionalTemplates().then((templates) => {
			return templates
				.map((templates) => {
					return {
						hadSucceed: true,
						data: templates,
					} as const;
				})
				.unwrapOrElse(() => {
					return {
						hadSucceed: false,
						reason: new Error(`Templates should be defined`),
					} as const;
				});
		});
	};

	private readonly getOptionalTemplates = async () => {
		return localForage
			.getItem(this.keys.templates)
			.then(singleFlowParser(schemas.cacheOrdinaryTemplates));
	};
}

const QuerySection = (
	props: DeepReadonly<{
		templates: {
			all: Optional<Templates>;
			selected: Optional<Templates>;
			updateSelected: (templates: Templates) => void;
		};
	}>
) => {
	const templates = {
		all: props.templates.all.unwrapOrGet([]),
		selected: props.templates.selected.unwrapOrGet([]),
	};

	const updateDependency =
		templates.selected
			.map(({ name }) => {
				return name;
			})
			.join() ||
		templates.all
			.map(({ name }) => {
				return name;
			})
			.join();

	return React.useMemo(() => {
		return (
			<StyledSelect
				isDisabled={props.templates.all.isNone()}
				isMulti={true}
				maxMenuHeight={200}
				placeholder="Search by Techs"
				loadingMessage={() => {
					return (
						<Box>
							<Text>Getting all the templates...</Text>
						</Box>
					);
				}}
				filterOption={({ label }, input) => {
					if (!input) {
						return true;
					}

					if (
						templates.all.find(({ name }) => {
							return name.toLowerCase() === input.toLowerCase();
						})
					) {
						return label.toLowerCase() === input.toLowerCase();
					}

					return (
						(new Fuse([label], {
							includeScore: true,
						})
							.search(input)
							.at(0)?.score ?? 1) <= 0.5
					);
				}}
				options={templates.all
					.toSorted((previous, current) => {
						return previous.name.localeCompare(
							current.name,
							undefined,
							{
								ignorePunctuation: true,
							}
						);
					})
					.map(({ name }) => {
						return {
							value: name,
							label: name,
						};
					})}
				onChange={(selectedTemplatesId) => {
					const names = parse(
						schemas.selectedOrdinaryTemplatesId,
						selectedTemplatesId
					).map(({ value }) => {
						return value;
					});

					props.templates.updateSelected(
						templates.all.filter(({ name }) => {
							return names.includes(name);
						})
					);
				}}
				value={templates.selected.map(({ name }) => {
					return {
						value: name,
						label: name,
					};
				})}
			/>
		);
	}, [updateDependency]);
};

const useNotification = () => {
	const [type, setType] = React.useState(
		'none' as 'loading' | 'succeed' | 'none' | 'failed'
	);

	React.useEffect(() => {
		toast.dismiss();

		switch (type) {
			case 'none': {
				break;
			}
			case 'loading': {
				toast.loading('Updating and retrieving templates...');
				break;
			}
			case 'succeed': {
				toast.success('All templates are updated and retrieved');
				break;
			}
			case 'failed': {
				toast.error('Failed to update and retrieve templates');
				break;
			}
		}
	}, [type]);

	return {
		updateState: {
			failed: () => {
				setType('failed');
			},
			succeed: () => {
				setType('succeed');
			},
			loading: () => {
				setType('loading');
			},
		},
	};
};

const Templates = () => {
	const delimiter = ',';

	const router = useRouter();

	const cache = new TemplatesCache({
		templates: 'templates',
	});

	const names = decodeURIComponent(
		parse(schemas.names, router.query.names ?? '')
	)
		.split(delimiter)
		.filter(Boolean);

	const clipboard = useCopyToClipboard();

	const notification = useNotification();

	const [{ all, selected }, setTemplate] = React.useState({
		all: Optional.none<Templates>(),
		selected: Optional.none<Templates>(),
	});

	const setSelected = (selected: Templates | Optional<Templates>) => {
		setTemplate((template) => {
			return {
				...template,
				selected: Array.isArray(selected)
					? Optional.some(selected)
					: selected,
			};
		});
	};

	const setAll = (all: Templates | Optional<Templates>) => {
		setTemplate((template) => {
			return {
				...template,
				all: Array.isArray(all) ? Optional.some(all) : all,
			};
		});
	};

	React.useEffect(() => {
		cache
			.updateTemplates(notification.updateState)
			.then((templates) => {
				if (templates.hadSucceed) {
					return templates.data;
				}

				throw templates.reason;
			})
			.then(setAll);
	}, [all.isSome()]);

	React.useEffect(() => {
		all.map((template) => {
			return template.filter((props) => {
				return names.includes(props.name);
			});
		}).map((template) => {
			setSelected(template);

			return template;
		});
	}, [all.isSome(), names.join()]);

	React.useEffect(() => {
		selected.map((selected) => {
			const params = formQueryParamStringFromRecord({
				names: selected
					.map(({ name }) => {
						return name;
					})
					.join(delimiter),
			});

			return router.push(
				`/templates${!params ? '' : '?'}${params}`,
				undefined,
				{
					shallow: true,
				}
			);
		});
	}, [
		selected.match({
			none: () => {
				return undefined;
			},
			some: (templates) => {
				return templates
					.map(({ name }) => {
						return name;
					})
					.join();
			},
		}),
	]);

	return (
		<Layout title="Templates">
			<ToastContainer position="top-center" autoClose={2500} stacked />
			<Container maxWidth="100%" display="grid" placeItems="center">
				<Box
					pt={16}
					display="flex"
					flexDirection="column"
					gap={16}
					width={{
						xl: '80%',
						base: '90%',
					}}
					minHeight="30vh"
					boxSizing="border-box"
				>
					<Box display="flex" justifyContent="space-between">
						<QuerySection
							templates={{
								all,
								selected,
								updateSelected: setSelected,
							}}
						/>
						<ButtonGroup gap={4} isDisabled={all.isNone()}>
							<Button
								colorScheme="messenger"
								disabled={selected.isNone()}
								onClick={() => {
									clipboard.copy(
										combineTemplates(
											selected.unwrapOrGet([])
										)
									);
								}}
							>
								{!clipboard.copied
									? 'Copy All'
									: '🎉 Copied All'}
							</Button>
							<Divider orientation="vertical" />
							<Button
								colorScheme="messenger"
								variant="outline"
								disabled={selected.isNone()}
								onClick={() => {
									const zip = selected
										.unwrapOrGet([])
										.reduce((zip, template) => {
											return zip.file(
												`${template.name}/.gitignore`,
												template.content
											);
										}, new JSZip());

									zip.generateAsync({
										type: 'blob',
									}).then((value) => {
										saveAs(
											value,
											'gitignored-compressed.zip'
										);
									});
								}}
							>
								Zip All
							</Button>
						</ButtonGroup>
					</Box>
					<Box display="flex" justifyContent="space-between">
						<TemplatesPreview
							type={selected.isSome() ? 'done' : 'loading'}
							templatesName={names}
							templates={selected.unwrapOrGet([])}
						/>
					</Box>
				</Box>
			</Container>
		</Layout>
	);
};

export default Templates;
