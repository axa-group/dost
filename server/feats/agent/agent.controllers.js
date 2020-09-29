/*
 * Copyright (c) AXA Group Operations Spain S.A.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const app = require('../../app');
const Logger = require('../../common/logger');
const Utils = require('../../common/utils');
const FileBundle = require('../../core/file-bundle');
const { UnknownFormatException } = require('../../exceptions');
const { Model, RowType, exportSettings, Format } = require('../../constants');
const { AgentStatus } = require('./agent.constants');

const logger = Logger.getInstance();

/**
 * Find by ide or returns an error.
 * @param {string} id Identifier
 * @param {Function} fn Callback function.
 */
async function findOrError(id, fn) {
  const agent = await app.database.findById(Model.Agent, id);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  return fn ? fn(agent) : agent;
}

/**
 * Find all agents.
 */
async function findAll() {
  return app.database.find(Model.Agent);
}

/**
 * Adds a new agent.
 * @param {object} request Request.
 */
async function add(request) {
  const updateData = JSON.parse(request.payload);
  updateData.status = AgentStatus.Ready;
  updateData.domains = [];
  return app.database.save(Model.Agent, updateData);
}

/**
 * Find all settings
 * @param {object} request Request
 */
async function findAllSettings(request) {
  return findOrError(request.params.id, x => x.settings);
}

/**
 * Update settings
 * @param {object} request Request
 */
async function updateSettings(request) {
  return findOrError(request.params.id, agent => {
    agent.settings = JSON.parse(request.payload);
    return app.database.saveItem(agent);
  });
}

/**
 * Find an agent by id.
 * @param {object} request Request
 */
async function findById(request) {
  return findOrError(request.params.id);
}

/**
 * Update an agent by id.
 * @param {object} request Request
 */
async function updateById(request) {
  const agentId = request.params.id;
  const data = JSON.parse(request.payload);
  return app.database.updateById(Model.Agent, agentId, data);
}

/**
 * Find domains by agent id.
 * @param {object} request Request
 */
async function findDomainsByAgentId(request) {
  const agentId = request.params.id;
  const domains = await app.database.find(Model.Domain, { agent: agentId });
  return {
    domains: app.database.processResponse(domains),
    total: domains.length
  };
}

/**
 * Delete an agent by id.
 * @param {object} request Request.
 */
async function deleteById(request) {
  const agentId = request.params.id;
  const domains = await app.database.find(Model.Domain, { agent: agentId });
  const removePromisesList = [];

  domains.forEach(domain => {
    const domainId = domain._id;

    removePromisesList.push(app.database.remove(Model.Intent, { domain: domainId }));
    removePromisesList.push(app.database.remove(Model.Scenario, { domain: domainId }));
  });

  await Promise.all(removePromisesList);

  await app.database.remove(Model.Entity, { agent: agentId });
  await app.database.remove(Model.Domain, { agent: agentId });

  return app.database.removeById(Model.Agent, agentId);
}

/**
 * Find intents in a domain.
 * @param {object} request Request
 */
async function findIntentsInDomainByIdByAgentId(request) {
  const { start, limit, filter } = request.query;
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const { domainId } = request.params;
  const query = {};
  if (domainId) {
    query.domain = domainId;
  }
  if (filter) {
    query.intentName = { $regex: filter, $options: 'i' };
  }

  let intents = await app.database.find(Model.Intent, query);
  const total = intents.length;
  if (start) {
    intents = intents.slice(start);
  }
  if (limit && limit > 0) {
    intents = intents.slice(0, limit - start);
  }
  return {
    intents: app.database.processResponse(intents),
    total
  };
}

/**
 * Find intents by agent id.
 * @param {object} request Request
 */
async function findIntentsByAgentId(request) {
  const { start, limit, filter } = request.query;
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const query = { agent: agentId };
  if (filter) {
    query.intentName = { $regex: filter, $options: 'i' };
  }
  let intents = await app.database.find(Model.Intent, query);
  const total = intents.length;
  if (start) {
    intents = intents.slice(start);
  }
  if (limit && limit > 0) {
    intents = intents.slice(0, limit - start);
  }
  return {
    intents: app.database.processResponse(intents),
    total
  };
}

/**
 * Find entities by agent id.
 * @param {object} request Request
 */
async function findEntitiesByAgentId(request) {
  const { start, limit, filter } = request.query;
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const query = { agent: agentId };
  if (filter) {
    query.entityName = { $regex: filter, $options: 'i' };
  }
  let entities = await app.database.find(Model.Entity, query);
  const total = entities.length;
  if (start) {
    entities = entities.slice(start);
  }
  if (limit && limit > 0) {
    entities = entities.slice(0, limit - start);
  }
  return {
    entities: app.database.processResponse(entities),
    total
  };
}

/**
 * Find domain by id
 * @param {object} request Request
 */
async function findDomainByIdByAgentId(request) {
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const { domainId } = request.params;
  const domain = await app.database.findById(Model.Domain, domainId);
  if (!domain) {
    return app.error(404, 'The domain was not found');
  }
  if (agentId !== domain.agent) {
    return app.error(404, 'The domain was not found in the agent');
  }
  domain.agentName = agent.agentName;
  return domain;
}

/**
 * Find and agent by name.
 * @param {object} request Request
 */
async function findByName(request) {
  const { agentName } = request.params;
  const agents = await app.database.find(Model.Agent, { agentName });
  if (!agents || agents.length === 0) {
    const agent = await app.database.findById(Model.Agent, agentName);
    if (!agent) {
      return app.error(404, 'The agent was not found');
    }
    return agent;
  }
  return agents[0];
}

/**
 * Find intent by domain and agent.
 * @param {object} request Request
 */
async function findIntentByIdInDomainByIdByAgentId(request) {
  const { domainId, intentId } = request.params;
  const intent = await app.database.findById(Model.Intent, intentId);
  if (!intent) {
    return app.error(404, 'The intent was not found');
  }
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const domain = await app.database.findById(Model.Domain, domainId);
  if (!domain) {
    return app.error(404, 'The domain was not found');
  }
  if (agentId !== domain.agent) {
    return app.error(404, 'The domain was not found in the agent');
  }
  intent.agentName = agent.agentName;
  intent.domainName = domain.domainName;
  return intent;
}

/**
 * Find scenario by domain and agent.
 * @param {object} request Request
 */
async function findIntentScenarioInDomainByIdByAgentId(request) {
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const { domainId, intentId } = request.params;
  const domain = await app.database.findById(Model.Domain, domainId);
  if (!domain) {
    return app.error(404, 'The domain was not found');
  }
  const intent = await app.database.findById(Model.Intent, intentId);
  if (!intent) {
    return app.error(404, 'The intent was not found');
  }
  const scenario = await app.database.findOne(Model.Scenario, { intent: intentId });
  if (!scenario) {
    return app.error(404, 'The scenario was not found');
  }
  scenario.agentName = agent.agentName;
  scenario.domainName = domain.domainName;
  scenario.intentName = intent.intentName;
  return scenario;
}

/**
 * Find entity by id.
 * @param {*} request Request
 */
async function findEntityByIdByAgentId(request) {
  const agentId = request.params.id;
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }
  const { entityId } = request.params;
  const entity = await app.database.findById(Model.Entity, entityId);
  if (!entity) {
    return app.error(404, 'The entity was not found');
  }
  if (entity.agent !== agentId) {
    return app.error(404, 'The entity was not found at the given agent');
  }
  entity.agentName = agent.agentName;
  return entity;
}

/**
 * Train an agent.
 * @param {object} request Request
 */
async function train(request) {
  const agentId = request.params.id;

  if (!app.existsTraining(agentId)) {
    const training = await app.database.findOne(Model.Training, {
      'any.agentId': agentId
    });
    if (training) {
      const model = JSON.parse(training.any.model);
      app.loadTraining(agentId, model);
    }
  }
  const agent = await app.database.findById(Model.Agent, agentId);
  if (!agent) {
    return app.error(404, 'The agent was not found');
  }

  const domains = await app.database.find(Model.Domain, { agent: agentId });
  const entities = await app.database.find(Model.Entity, { agent: agentId });
  const intents = await app.database.find(Model.Intent, { agent: agentId });
  const scenarios = await app.database.find(Model.Scenario, { agent: agentId });
  const data = {
    agent,
    domains,
    intents,
    scenarios,
    entities
  };
  if (agent.status !== AgentStatus.Training) {
    agent.status = AgentStatus.Training;
    app.database.saveItem(agent);
    let model = await app.train(data);
    if (model) {
      await app.database.deleteMany(Model.Training, { 'any.agentId': agentId });
      model = JSON.stringify(model);
      await app.database.save(Model.Training, { any: { agentId, model } });
    }
    agent.lastTraining = new Date();
    agent.status = AgentStatus.Ready;
    return app.database.saveItem(agent);
  }
  return {};
}

/**
 * Method that performs replacements of entity values in the answer
 * @param answer incoming from nlp.js result)
 * @param agentId to filter by agent
 * @return {Promise<String>}
 */
async function processSlots(answer, agentId) {
	const { srcAnswer, entities } = answer;

	try {
		const intent = await app.database.findOne(Model.Intent, {
			intentName: answer.intent,
      agent: agentId
		});

		if (intent) {
			const intentId = intent._id.toString();
			const scenario = await app.database.findOne(Model.Scenario, {
				intent: intentId,
        agent: agentId
			});

			let processedAnswer = srcAnswer;

			scenario.slots.forEach(slot => {
				const slotKeyName = `{{slots.${slot.slotName}.name}}`;
				const slotKeyValue = `{{slots.${slot.slotName}.value}}`;
				const slotKeySourceValue = `{{slots.${slot.slotName}.sourceText}}`;

				if (slotKeyName.includes(slot.slotName)) {
					logger.debug(`Replacing ${slotKeyName} by ${slot.slotName}`);
					processedAnswer = processedAnswer.replace(new RegExp(slotKeyName, 'gi'), slot.slotName);
				}

				let entity;

				if (slotKeyValue.includes(slot.slotName)) {
					entity = entities.find(item => item.entity === slot.entity);

					if (entity) {
						logger.debug(`Replacing ${slotKeyValue} by ${entity.option}`);
						processedAnswer = processedAnswer.replace(new RegExp(slotKeyValue, 'gi'), entity.option);
					}
				}

				if (slotKeySourceValue.includes(slot.slotName)) {
					entity = entity || entities.find(item => item.entity === slot.entity);

					if (entity) {
						logger.debug(`Replacing ${slotKeySourceValue} by ${entity.sourceText}`);
						processedAnswer = processedAnswer.replace(new RegExp(slotKeySourceValue, 'gi'), entity.sourceText);
					}
				}
			});
			return processedAnswer;
		}
		return srcAnswer;
	} catch(error) {
		logger.error(error);
		return srcAnswer;
	}
}

function isUsingSlots(srcAnswer) {
	return srcAnswer.includes('{{slots.');
}

/**
 * It returns a fallback response based on settings hierarchy (1st agent, 2nd global settings, 3rd default)
 * @param agentId
 * @return {Promise<string>}
 */
async function getFallbackResponse(agentId) {
	let fallbackResponses;

	const agent = await app.database.findById(Model.Agent, agentId);
	if (agent && agent.fallbackResponses && agent.fallbackResponses.length) {
		fallbackResponses = agent.fallbackResponses;
	} else {
		const settings = await app.database.findOne(Model.Settings);

		fallbackResponses = settings.any.defaultAgentFallbackResponses;
	}
	const randomIndex = Utils.getRandomInt(0, fallbackResponses.length - 1);

	return fallbackResponses.length ? fallbackResponses[randomIndex] : '...';
}

/**
 * Converse with an agent.
 * @param {object} request Request.
 */
async function converse(request) {
  const agentId = request.params.id;
  if (!app.existsTraining(agentId)) {
    const training = await app.database.findOne(Model.Training, {
      'any.agentId': agentId
    });
    if (!training) {
      return app.error(404, 'Agent training not found');
    }
    const model = JSON.parse(training.any.model);
    app.loadTraining(agentId, model);
  }
  const { sessionId } = request.query;
  const { text } = request.query;
  let sessionAny = await app.database.findOne(Model.Session, {
    'any.agentId': agentId,
    'any.sessionId': sessionId
  });
  if (!sessionAny) {
    sessionAny = {
      any: {
        agentId,
        sessionId,
        context: {}
      }
    };
  }
  const answer = await app.converse(agentId, sessionAny.any, text);

  logger.debug({ answer });

  const scoreDomain  = await app.database.findOne(Model.Domain,{
    'agent': agentId
  })

  const scoreAgent  = await app.database.findById(Model.Agent,{'_id' : agentId })

  const scoreAgentOrDomain =  scoreAgent.domainClassifierThreshold >= scoreDomain.intentThreshold  ? scoreAgent.domainClassifierThreshold :  scoreDomain.intentThreshold

  if (answer.intent === 'None' || answer.score < scoreAgentOrDomain) {
    const fallbackResponse = await getFallbackResponse(agentId);

    answer.srcAnswer = fallbackResponse;
    answer.answer = fallbackResponse;
    answer.textResponse = fallbackResponse;
  } else if (answer.srcAnswer && isUsingSlots(answer.srcAnswer)) {
    answer.textResponse = await processSlots(answer, agentId);
  } else {
    answer.textResponse = answer.answer;
  }

  await app.database.save(Model.Session, sessionAny);

  return answer;
}

async function readContentHierarchyFromDb(agentId, headers) {
  const contentMatrix = [headers];
  const agent = await app.database.findById(Model.Agent, agentId);
  const domains = await app.database.find(Model.Domain, { agent: agentId });
  const agentsPrefix = [agent.agentName, agent._id];

  for(const domain of domains) {
    const { domainName, language } = domain;
    const domainPrefix = [...agentsPrefix, domainName, domain._id, language];

    const intents = await app.database.find(Model.Intent, { agent: agentId, domain: domain._id });

    for(const intent of intents) {
      const { intentName } = intent;
      const intentPrefix = [...domainPrefix, intentName, intent._id];

      intent.examples.forEach(example => {
        contentMatrix.push(intentPrefix.concat([RowType.Example, example.userSays]));
      });

      const scenarios = await app.database.find(Model.Scenario, { agent: agentId, domain: domain._id, intent: intent._id });

      if (scenarios.length) {
        scenarios[0].intentResponses.forEach(response => {
          contentMatrix.push(intentPrefix.concat([RowType.Response, response]));
        });
      }
    }
  }
  return contentMatrix;
}

async function generateCsvContent(agentId) {
  const { headers } = exportSettings.csv;
  const contentMatrix = await readContentHierarchyFromDb(agentId, headers);
  const { sep } = exportSettings.csv;
  let content = '';

  contentMatrix.forEach(row => {
    content += `"${row.join(`"${sep}"`)}"\n`;
  });

  return content;
}

async function generateContent(agentId, format) {
  let content;

  if (format === Format.csv) {
    content = await generateCsvContent(agentId);
  } else {
    throw new UnknownFormatException();
  }

  return content;
}

async function exportContent(request, h) {
  const agentId = request.params.id;
  const { format } = request.query;
  const outputFormat = format ? format.toLowerCase() : Format.default;
  const timestamp = new Date().getTime();
  const filename = `${timestamp}-${Model.Agent}.${outputFormat}`;
  let responseBundle;

  try {
    const content = await generateContent(agentId, outputFormat);
    const response = h.response(content);

    response.headers['Content-disposition'] = `attachment; filename=${filename}`;
    response.headers['Content-type'] = `application/octet-stream; charset=utf-8; header=present;`;
    response.type('application/octet-stream');
    responseBundle = new FileBundle(response);
  } catch(error) {
    responseBundle = error;
  }

  return responseBundle;
}

async function updateAgentStatus(query, newStatus) {
	const agent = await app.database.findOne(Model.Agent, query);

	logger.debug(`agent > updateAgentStatus ${newStatus}`);

	if (!agent) {
		return app.error(404, 'The agent was not found');
	}
	agent.status = newStatus;
	return app.database.saveItem(agent);
}

module.exports = {
  findOrError,
  findAll,
  add,
  findAllSettings,
  updateSettings,
  findById,
  updateById,
  findDomainsByAgentId,
  deleteById,
  findIntentsInDomainByIdByAgentId,
  findIntentsByAgentId,
  findEntitiesByAgentId,
  findDomainByIdByAgentId,
  findByName,
  findIntentByIdInDomainByIdByAgentId,
  findIntentScenarioInDomainByIdByAgentId,
  findEntityByIdByAgentId,
  train,
  converse,
  exportContent,
  updateAgentStatus
};
