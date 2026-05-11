require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent 
    ] 
});

const CANAL_CONVITES_ID = '1483471183507882004'; 
const CANAL_LOG_ID = '1493280311847682168';      
const CANAL_STREAK_INICIAR = '1493987145705193494'; 
const CANAL_MODS_ID = '1493987198507155660';     
const CANAL_STREAK_HISTORICO = '1493989461170716853';

const fogueirasAtivas = new Map();
const dbStreaks = './streaks.json';

const USUARIOS_VINCULADOS = {
    principal: '1468587774889164850',
    secundarios: ['208380369261559808', '782214434789523506']
};

function normalizarUsuarioId(userId) {
    if (USUARIOS_VINCULADOS.secundarios.includes(userId)) {
        return USUARIOS_VINCULADOS.principal;
    }
    return userId;
}

function normalizarListaUsuarios(userIds) {
    const mapaNormalizado = new Map();
    for (const userId of userIds) {
        const idNormalizado = normalizarUsuarioId(userId);
        if (!mapaNormalizado.has(idNormalizado)) {
            mapaNormalizado.set(idNormalizado, userId);
        }
    }
    return Array.from(mapaNormalizado.keys());
}

function carregarStreaks() {
    try {
        if (!fs.existsSync(dbStreaks)) return {};
        const data = fs.readFileSync(dbStreaks, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Erro ao ler streaks.json:', error.message);
        if (fs.existsSync(dbStreaks)) {
            const backupName = `${dbStreaks}.backup_${Date.now()}`;
            fs.copyFileSync(dbStreaks, backupName);
            console.log(`📁 Backup criado: ${backupName}`);
        }
        return {};
    }
}

function salvarStreaks(dados) {
    try {
        fs.writeFileSync(dbStreaks, JSON.stringify(dados, null, 4));
    } catch (error) {
        console.error('❌ Erro ao salvar streaks.json:', error.message);
    }
}

function gerarTextoDaLista(jogadores) {
    const jogadoresValidos = jogadores.filter(id => id && id !== 'null' && id !== 'undefined');
    
    let texto = "**Squad Atual:**\n\n";
    
    if (jogadoresValidos.length === 0) {
        texto += "⏳ Ninguém no squad ainda...\n";
    } else {
        texto += `👑 1. <@${jogadoresValidos[0]}>\n`;
        for (let i = 1; i < 4; i++) {
            if (jogadoresValidos[i]) {
                texto += `🔪 ${i + 1}. <@${jogadoresValidos[i]}>\n`;
            } else {
                texto += `⏳ ${i + 1}. Aguardando...\n`;
            }
        }
    }
    return texto;
}

function formatarTempo(ms) {
    const segundos = Math.floor((ms / 1000) % 60);
    const minutos = Math.floor((ms / (1000 * 60)) % 60);
    const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
    
    let tempo = '';
    if (horas > 0) tempo += `${horas}h `;
    if (minutos > 0 || horas > 0) tempo += `${minutos}m `;
    tempo += `${segundos}s`;
    return tempo;
}

async function enviarLog(dadosFogueira, client) {
    try {
        const canalLog = await client.channels.fetch(CANAL_LOG_ID).catch(() => null);
        if (!canalLog) {
            console.error('❌ Canal de log não encontrado ou inacessível');
            return;
        }

        const duracaoMs = Date.now() - dadosFogueira.startTime;
        const tempoFormatado = formatarTempo(duracaoMs);

        const participantesUnicos = [...new Set(dadosFogueira.participantes || [])];
        const participantesValidos = participantesUnicos.filter(id => id && id !== 'null' && id !== 'undefined');
        
        console.log(`📝 Gerando log com participantes: ${participantesValidos.join(', ')}`);
        
        const listaCompleta = [...participantesValidos];
        while (listaCompleta.length < 4) {
            listaCompleta.push(null);
        }

        let textoParticipantes = "";
        for (let i = 0; i < listaCompleta.length; i++) {
            if (listaCompleta[i]) {
                const numero = i + 1;
                const emoji = numero === 1 ? "👑" : "🔪";
                textoParticipantes += `${emoji} ${numero}. <@${listaCompleta[i]}>\n`;
            } else {
                textoParticipantes += `⏳ ${i + 1}. (vazio)\n`;
            }
        }

        const embedLog = new EmbedBuilder()
            .setColor('#8a2be2') 
            .setTitle('📜 LOG: Squad Finalizado')
            .addFields(
                { name: '⏳ Duração da Jogatina', value: tempoFormatado, inline: false },
                { name: '👥 Participantes', value: textoParticipantes || 'Nenhum participante registrado', inline: false },
                { name: '🔊 Call Utilizada', value: `<#${dadosFogueira.callId}>`, inline: false }
            )
            .setTimestamp();

        await canalLog.send({ embeds: [embedLog] });
        console.log('✅ Log enviado com sucesso!');
    } catch (e) {
        console.error('❌ Erro ao enviar log:', e);
    }
}

async function atualizarMensagemSquad(msgId, dados, client) {
    try {
        const chatCanal = await client.channels.fetch(dados.chatId).catch(() => null);
        if (!chatCanal) return;
        
        const msgBusca = await chatCanal.messages.fetch(msgId).catch(() => null);
        if (!msgBusca) return;
        
        const jogadoresParaExibir = dados.participantes.slice(0, 4);
        const jogadoresValidos = jogadoresParaExibir.filter(id => id && id !== 'null' && id !== 'undefined');
        
        const embedAtualizado = EmbedBuilder.from(msgBusca.embeds[0])
            .setDescription(`**${msgBusca.interaction?.user?.username || 'Líder'}** abriu a call <#${dados.callId}>!\n\n${gerarTextoDaLista(jogadoresValidos)}`);
        
        const components = ActionRowBuilder.from(msgBusca.components[0]);
        
        if (jogadoresValidos.length >= 4) {
            components.components[0].setDisabled(true).setLabel('Squad Cheio').setStyle(ButtonStyle.Secondary);
            embedAtualizado.setColor('#00ff00').setTitle('✅ SQUAD FECHADO');
        } else {
            components.components[0].setDisabled(false).setLabel('Entrar no Squad').setStyle(ButtonStyle.Success);
            embedAtualizado.setColor('#ff4500').setTitle('🔥 SQUAD PRIVADO EM FORMAÇÃO');
        }
        
        await msgBusca.edit({ embeds: [embedAtualizado], components: [components] }).catch(() => null);
    } catch (e) {
        console.error('❌ Erro ao atualizar mensagem:', e);
    }
}

client.once('ready', async () => {
    console.log(`✅ Logado como ${client.user.tag}`);
    
    const canais = [CANAL_CONVITES_ID, CANAL_LOG_ID, CANAL_STREAK_INICIAR, CANAL_MODS_ID, CANAL_STREAK_HISTORICO];
    
    for (const id of canais) {
        try {
            const channel = await client.channels.fetch(id);
            console.log(`✅ Canal ${id}: ${channel?.name || 'OK'}`);
        } catch (e) {
            console.error(`❌ Canal ${id} não encontrado ou inacessível!`);
        }
    }
    
    console.log(`✅ Sistema de vinculação ativo: ${USUARIOS_VINCULADOS.principal} + ${USUARIOS_VINCULADOS.secundarios.length} contas vinculadas`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: [
                { name: 'fogueira', description: 'Cria um squad privado e anuncia a call!' },
                { name: 'fogueira_manual', description: 'Manual detalhado do sistema de PTs.' },
                { name: 'streak_manual', description: 'Manual detalhado do sistema de Streaks.' },
                { 
                    name: 'streak_iniciar', 
                    description: 'Começa uma nova sequência de vitórias (Streak)!',
                    options: [
                        {
                            name: 'sobrevivente',
                            description: 'Inicia uma streak de Sobrevivente',
                            type: 1, 
                            options: [
                                { name: 'membro2', description: 'Menção do 2º Jogador (@)', type: 6, required: false },
                                { name: 'membro3', description: 'Menção do 3º Jogador (@)', type: 6, required: false },
                                { name: 'membro4', description: 'Menção do 4º Jogador (@)', type: 6, required: false }
                            ]
                        },
                        {
                            name: 'assassino',
                            description: 'Inicia uma streak de Assassino',
                            type: 1, 
                            options: [
                                { name: 'nome', description: 'Qual o nome do Assassino?', type: 3, required: true }
                            ]
                        }
                    ]
                },
                { 
                    name: 'streak_enviar', 
                    description: 'Envia o print da partida para a moderação aprovar.',
                    options: [{ name: 'print', description: 'Print da pontuação final.', type: 11, required: true }]
                },
                { name: 'streak_pausar', description: 'Pausa a sua streak atual para continuar depois.' },
                { name: 'streak_continuar', description: 'Retoma uma streak que estava pausada.' },
                { name: 'streak_finalizar', description: 'Encerra a streak de vez e salva no Histórico!' },
                { name: 'streak_excluir', description: 'Cancela e deleta sua streak atual sem salvar nada.' }
            ]
        });
        console.log('✅ Comandos slash registrados com sucesso!');
    } catch (error) { 
        console.error('❌ Erro ao registrar comandos:', error);
    }
});

client.on('messageCreate', async message => {
    if (message.channelId === CANAL_STREAK_INICIAR && !message.author.bot) {
        await message.delete().catch(() => null);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const canalId = newState.channelId || oldState.channelId;
    if (!canalId) return;
    
    const fogueiraEntry = Array.from(fogueirasAtivas.entries()).find(([msgId, dados]) => dados.callId === canalId);
    if (!fogueiraEntry) return;
    
    const [msgId, dados] = fogueiraEntry;
    const canal = newState.channel || oldState.channel;
    if (!canal) return;
    
    const userId = newState.member?.id || oldState.member?.id;
    if (!userId) return;
    
    const userIdNormalizado = normalizarUsuarioId(userId);
    
    console.log(`🔄 Atualização de voz detectada: ${userIdNormalizado} - Entrou: ${!!newState.channelId} - Saiu: ${!!oldState.channelId}`);
    
    if (newState.channelId === canalId && !oldState.channelId) {
        console.log(`✅ ${userIdNormalizado} ENTROU na call`);
        
        if (!dados.participantes.includes(userIdNormalizado)) {
            dados.participantes.push(userIdNormalizado);
            console.log(`📝 Adicionado aos participantes permanentes. Total: ${dados.participantes.length}`);
        }
        
        if (!dados.jogadoresAtuais.includes(userIdNormalizado) && dados.jogadoresAtuais.length < 4) {
            dados.jogadoresAtuais.push(userIdNormalizado);
            console.log(`👥 Adicionado aos jogadores atuais. Squad: ${dados.jogadoresAtuais.join(', ')}`);
            await atualizarMensagemSquad(msgId, dados, client);
        } else if (dados.jogadoresAtuais.length >= 4) {
            console.log(`⚠️ Squad já está cheio (4/4), ${userIdNormalizado} não foi adicionado à lista atual`);
        }
    }
    
    if (oldState.channelId === canalId && !newState.channelId) {
        console.log(`❌ ${userIdNormalizado} SAIU da call`);
        
        const index = dados.jogadoresAtuais.indexOf(userIdNormalizado);
        if (index !== -1) {
            dados.jogadoresAtuais.splice(index, 1);
            console.log(`👥 Removido dos jogadores atuais. Squad agora: ${dados.jogadoresAtuais.join(', ') || 'vazio'}`);
            await atualizarMensagemSquad(msgId, dados, client);
        }
    }
    
    const membrosAtuais = Array.from(canal.members.keys());
    const membrosNormalizados = normalizarListaUsuarios(membrosAtuais);
    
    console.log(`📊 Membros atuais na call (normalizados): ${membrosNormalizados.join(', ') || 'nenhum'}`);
    console.log(`📝 Participantes registrados até agora: ${dados.participantes.join(', ') || 'nenhum'}`);
    
    if (membrosNormalizados.length === 0) {
        console.log(`🏁 Call esvaziou! Finalizando squad e gerando log...`);
        try {
            await enviarLog(dados, client);
            
            const chatCanal = await client.channels.fetch(dados.chatId).catch(() => null);
            if (chatCanal) {
                const msgBusca = await chatCanal.messages.fetch(msgId).catch(() => null);
                if (msgBusca) {
                    const embedFinalizado = EmbedBuilder.from(msgBusca.embeds[0])
                        .setTitle('🛑 SQUAD FINALIZADO')
                        .setColor('#555555') 
                        .setFooter({ text: 'A call esvaziou e o squad foi finalizado.' });
                    
                    await msgBusca.edit({ embeds: [embedFinalizado], components: [] }).catch(() => null);
                }
            }
            fogueirasAtivas.delete(msgId);
            console.log(`✅ Squad finalizado e removido da memória`);
        } catch (e) {
            console.error('❌ Erro ao finalizar squad por esvaziamento:', e);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'fogueira_manual') {
        const embed = new EmbedBuilder()
            .setColor('#ff4500')
            .setTitle('🏕️ MANUAL: Sistema de Fogueira (Squads)')
            .setDescription('O `/fogueira` é a melhor forma de organizar um time e jogar sem preocupações!')
            .addFields(
                { name: '1. Como funciona?', value: 'Entre em um canal de voz (sozinho ou com amigos) e digite `/fogueira`. O bot vai anunciar a call e criar um sistema de squad.' },
                { name: '2. Como as pessoas entram?', value: 'Existem duas formas: clicando no botão "Entrar no Squad" ou simplesmente entrando direto na call de voz. O bot detecta automaticamente quem entrou e atualiza a lista do squad!' },
                { name: '3. Limite do Squad', value: 'O squad tem limite de 4 jogadores. Quando a lista completa, o bot avisa que o time está fechado.' },
                { name: '4. Finalizando', value: 'Quando todos saírem da call, o bot finaliza o squad automaticamente e gera um log de quanto tempo vocês jogaram, com a lista de TODOS que participaram (mesmo que tenham saido antes)!' }
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_manual') {
        const embed = new EmbedBuilder()
            .setColor('#1e90ff')
            .setTitle('🏆 MANUAL: Sistema de Streaks')
            .setDescription('Registre suas sequências de vitórias e suba no placar do servidor!')
            .addFields(
                { name: '1. Iniciando a Jornada', value: 'Digite `/streak_iniciar`. O Discord pedirá para escolher entre `sobrevivente` ou `assassino`. O bot anunciará o início da sua streak.' },
                { name: '2. Enviando Provas', value: 'Após **cada partida vencida**, digite `/streak_enviar` e anexe o print da tela final. Essa prova irá para o Tribunal da Moderação.' },
                { name: '3. Aprovação e Histórico', value: 'Se os mods aprovarem, você ganha +1 ponto e o bot anuncia a sua subida no canal de Histórico! Se for recusado, você será avisado.' },
                { name: '4. Pausar e Continuar', value: 'O time precisou sair? Use `/streak_pausar`. Quando todos voltarem, use `/streak_continuar` para retomar de onde pararam.' },
                { name: '5. Finalizando', value: 'Cansou ou perdeu a streak? Use `/streak_finalizar` para salvar de vez seu recorde no Histórico. Se algo deu errado e quiser só cancelar, use `/streak_excluir`.' }
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_iniciar') {
        if (interaction.channelId !== CANAL_STREAK_INICIAR) return interaction.reply({ content: `❌ Use este comando no canal <#${CANAL_STREAK_INICIAR}>!`, flags: MessageFlags.Ephemeral });

        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (streaks[userIdNormalizado]) {
            return interaction.reply({ content: '❌ Você já tem uma streak (ativa ou pausada)! Use `/streak_continuar` para voltar, `/streak_finalizar` para salvar o recorde de vez, ou `/streak_excluir` para apagar.', flags: MessageFlags.Ephemeral });
        }

        const subcomando = interaction.options.getSubcommand();
        let detalhe = '';
        let fotoAssassino = null;

        if (subcomando === 'sobrevivente') {
            const p2 = interaction.options.getUser('membro2');
            const p3 = interaction.options.getUser('membro3');
            const p4 = interaction.options.getUser('membro4');
            
            let equipe = [`<@${userIdNormalizado}>`];
            if (p2) equipe.push(`<@${normalizarUsuarioId(p2.id)}>`);
            if (p3) equipe.push(`<@${normalizarUsuarioId(p3.id)}>`);
            if (p4) equipe.push(`<@${normalizarUsuarioId(p4.id)}>`);
            detalhe = equipe.join(', ');
        } else {
            const nomeDigitado = interaction.options.getString('nome');
            detalhe = nomeDigitado;
            const nomeFormatado = nomeDigitado.replace(/ /g, '%20');
            fotoAssassino = `https://raw.githubusercontent.com/Antonizinhobr/dbdclan-com/SH4DOW/assets/img/dbd/killers/${nomeFormatado}.png`;
        }

        streaks[userIdNormalizado] = {
            ativa: true,
            lado: subcomando,
            detalhe: detalhe,
            vitorias: 0
        };
        salvarStreaks(streaks);

        const embed = new EmbedBuilder()
            .setColor(subcomando === 'sobrevivente' ? '#1e90ff' : '#8b0000')
            .setTitle('🔥 NOVA STREAK INICIADA!')
            .setDescription(`**Líder:** <@${userIdNormalizado}>\n**Lado:** ${subcomando === 'sobrevivente' ? '🏃 Sobrevivente' : '🔪 Assassino'}\n${subcomando === 'assassino' ? `**Assassino:** ${detalhe}` : `**Time:** ${detalhe}`}`)
            .setFooter({ text: 'Usem /streak_enviar após cada partida!' });

        if (fotoAssassino) embed.setThumbnail(fotoAssassino);

        return interaction.reply({ content: '@here A caçada começou!', embeds: [embed] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_enviar') {
        if (interaction.channelId !== CANAL_STREAK_INICIAR) return interaction.reply({ content: `❌ Use este comando no canal <#${CANAL_STREAK_INICIAR}>!`, flags: MessageFlags.Ephemeral });

        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        const minhaStreak = streaks[userIdNormalizado];

        if (!minhaStreak) return interaction.reply({ content: '❌ Nenhuma streak registrada! Use `/streak_iniciar` primeiro.', flags: MessageFlags.Ephemeral });
        if (!minhaStreak.ativa) return interaction.reply({ content: '⏸️ Sua streak está pausada! Use `/streak_continuar` antes de enviar novas provas.', flags: MessageFlags.Ephemeral });

        const print = interaction.options.getAttachment('print');
        if (!print.contentType || !print.contentType.startsWith('image/')) return interaction.reply({ content: '❌ Anexe uma imagem válida!', flags: MessageFlags.Ephemeral });

        const tribunal = await client.channels.fetch(CANAL_MODS_ID).catch(() => null);
        if (!tribunal) {
            return interaction.reply({ content: '❌ Canal de moderação não encontrado!', flags: MessageFlags.Ephemeral });
        }
        
        const embedMod = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('⚖️ REVISÃO DE STREAK')
            .setDescription(`Jogador <@${userIdNormalizado}> enviou uma prova.\n**Lado:** ${minhaStreak.lado}\n**Time/Killer:** ${minhaStreak.detalhe}\n**Vitórias Atuais:** ${minhaStreak.vitorias}`)
            .setImage(print.url);

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprovar_${userIdNormalizado}`).setLabel('Aprovar (+1)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`recusar_${userIdNormalizado}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );

        await tribunal.send({ content: '@everyone Nova prova enviada!', embeds: [embedMod], components: [botoes] });
        return interaction.reply({ content: '✅ Prova enviada para o Tribunal! Aguarde a moderação.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_pausar') {
        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (!streaks[userIdNormalizado]) return interaction.reply({ content: '❌ Você não tem nenhuma streak.', flags: MessageFlags.Ephemeral });
        if (!streaks[userIdNormalizado].ativa) return interaction.reply({ content: '⚠️ Sua streak já está pausada.', flags: MessageFlags.Ephemeral });

        streaks[userIdNormalizado].ativa = false;
        salvarStreaks(streaks);

        return interaction.reply({ content: `⏸️ A Streak foi pausada com **${streaks[userIdNormalizado].vitorias} vitória(s)**. Quando todos estiverem prontos de novo, usem \`/streak_continuar\`!` });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_continuar') {
        if (interaction.channelId !== CANAL_STREAK_INICIAR) return interaction.reply({ content: `❌ Use este comando no canal <#${CANAL_STREAK_INICIAR}>!`, flags: MessageFlags.Ephemeral });

        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (!streaks[userIdNormalizado]) return interaction.reply({ content: '❌ Você não tem nenhuma streak para continuar.', flags: MessageFlags.Ephemeral });
        if (streaks[userIdNormalizado].ativa) return interaction.reply({ content: '⚠️ Sua streak já está ativa.', flags: MessageFlags.Ephemeral });

        streaks[userIdNormalizado].ativa = true;
        salvarStreaks(streaks);

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🔄 STREAK RETOMADA!')
            .setDescription(`O jogador <@${userIdNormalizado}> reuniu as forças e voltou para a caçada!\n\n**Vitórias Atuais:** 🏆 **${streaks[userIdNormalizado].vitorias}**\n**Formação:** ${streaks[userIdNormalizado].detalhe}`)
            .setFooter({ text: 'A Entidade está sedenta. Mandem as provas!' });

        return interaction.reply({ content: '@here', embeds: [embed] });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_finalizar') {
        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (!streaks[userIdNormalizado]) return interaction.reply({ content: '❌ Você não tem nenhuma streak registrada para finalizar.', flags: MessageFlags.Ephemeral });

        const vit = streaks[userIdNormalizado].vitorias;
        delete streaks[userIdNormalizado]; 
        salvarStreaks(streaks);

        const historico = await client.channels.fetch(CANAL_STREAK_HISTORICO).catch(() => null);
        if (historico) {
            const embedHist = new EmbedBuilder()
                .setColor('#8a2be2')
                .setTitle('🛑 JORNADA ENCERRADA')
                .setDescription(`O jogador <@${userIdNormalizado}> finalizou sua streak de vez!\n\n**Total de Vitórias Consolidadas:** 🏆 **${vit}**`)
                .setTimestamp();
            historico.send({ embeds: [embedHist] });
        }

        return interaction.reply({ content: `✅ Você finalizou sua Streak de vez! Seu recorde de **${vit} vitórias** foi para o mural do Histórico.` });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'streak_excluir') {
        let streaks = carregarStreaks();
        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (!streaks[userIdNormalizado]) return interaction.reply({ content: '❌ Você não tem streak ativa para excluir.', flags: MessageFlags.Ephemeral });

        delete streaks[userIdNormalizado]; 
        salvarStreaks(streaks);

        return interaction.reply({ content: `🗑️ Sua streak foi deletada com sucesso. Nenhum histórico foi salvo.`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.isButton() && (interaction.customId.startsWith('aprovar_') || interaction.customId.startsWith('recusar_'))) {
        const dados = interaction.customId.split('_');
        const acao = dados[0];
        let userId = dados[1];

        if (acao === 'aprovar') {
            let streaks = carregarStreaks();
            if (!streaks[userId]) return interaction.reply({ content: 'A streak foi finalizada ou deletada pelo usuário.', flags: MessageFlags.Ephemeral });

            streaks[userId].vitorias += 1;
            salvarStreaks(streaks);

            const embedMod = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#00ff00').setTitle('✅ APROVADA');
            await interaction.message.edit({ embeds: [embedMod], components: [] });

            const canalHist = await client.channels.fetch(CANAL_STREAK_HISTORICO).catch(() => null);
            if (canalHist) {
                const embedHist = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('🔥 STREAK ATUALIZADA!')
                    .setDescription(`O jogador <@${userId}> acaba de subir sua Streak!\n\n**Total de Vitórias:** 🏆 **${streaks[userId].vitorias}**\n**Formação:** ${streaks[userId].detalhe}`)
                    .setTimestamp();
                await canalHist.send({ content: `@here`, embeds: [embedHist] });
            }
            return interaction.reply({ content: 'Aprovado com sucesso.', flags: MessageFlags.Ephemeral });
        }

        if (acao === 'recusar') {
            const modal = new ModalBuilder().setCustomId(`modal_motivo_${userId}`).setTitle('Motivo da Recusa');
            const entradaMotivo = new TextInputBuilder().setCustomId('texto_motivo').setLabel('Por que a print foi recusada?').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(entradaMotivo));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_motivo_')) {
        const userId = interaction.customId.split('_')[2];
        const motivo = interaction.fields.getTextInputValue('texto_motivo');

        const embedMod = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#ff0000').setTitle('❌ RECUSADA').setFooter({ text: `Motivo: ${motivo}` });
        await interaction.message.edit({ embeds: [embedMod], components: [] });

        const canalInicar = await client.channels.fetch(CANAL_STREAK_INICIAR).catch(() => null);
        if (canalInicar) await canalInicar.send({ content: `⚠️ <@${userId}>, sua última prova de Streak foi **RECUSADA** pela moderação.\n**Motivo:** ${motivo}\nEnvie uma nova prova.` });
        
        return interaction.reply({ content: 'Recusa registrada!', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isChatInputCommand() && interaction.commandName === 'fogueira') {
        if (interaction.channelId !== CANAL_CONVITES_ID) {
            return interaction.reply({ content: `❌ Este comando só pode ser usado no canal <#${CANAL_CONVITES_ID}>!`, flags: MessageFlags.Ephemeral });
        }

        const lider = interaction.member;
        const canalDeVoz = lider.voice.channel;

        if (!canalDeVoz) return interaction.reply({ content: '❌ Entre em uma call primeiro para criar um squad!', flags: MessageFlags.Ephemeral });

        const membrosNaCall = Array.from(canalDeVoz.members.keys());
        const membrosUnicos = normalizarListaUsuarios(membrosNaCall);
        
        const participantes = [...membrosUnicos];
        const jogadoresAtuais = [...membrosUnicos];

        console.log(`🎮 Squad criado! Participantes iniciais: ${participantes.join(', ')}`);

        try {
            await canalDeVoz.permissionOverwrites.set([{ id: interaction.guild.id, allow: [PermissionFlagsBits.Connect] }]);
        } catch (e) {
            console.error('❌ Erro ao garantir permissões da call:', e);
        }

        const pt = {
            liderId: normalizarUsuarioId(lider.id),
            participantes: participantes,
            jogadoresAtuais: jogadoresAtuais,
            callId: canalDeVoz.id,
            chatId: interaction.channelId,
            startTime: Date.now() 
        };

        const listaAtual = [...jogadoresAtuais];
        while (listaAtual.length < 4) {
            listaAtual.push(null);
        }

        const embed = new EmbedBuilder()
            .setColor(jogadoresAtuais.length >= 4 ? '#00ff00' : '#ff4500')
            .setTitle(jogadoresAtuais.length >= 4 ? '✅ SQUAD FECHADO' : '🔥 SQUAD PRIVADO EM FORMAÇÃO')
            .setDescription(`**${interaction.user.username}** abriu a call <#${canalDeVoz.id}>!\n\n${gerarTextoDaLista(listaAtual)}`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Clique no botão para entrar OU apenas entre na call! O bot detecta automaticamente.' });

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('entrar_pt').setLabel('Entrar no Squad').setStyle(ButtonStyle.Success).setEmoji('🏕️').setDisabled(jogadoresAtuais.length >= 4),
            new ButtonBuilder().setCustomId('cancelar_pt').setLabel('Finalizar Squad').setStyle(ButtonStyle.Danger).setEmoji('🔓')
        );

        const resposta = await interaction.reply({ 
            content: '🔥 Atenção <@&1483433110564503662>! Squad formado!',
            embeds: [embed], 
            components: [botoes], 
            fetchReply: true 
        });
        
        fogueirasAtivas.set(resposta.id, pt);
        console.log(`✅ Squad registrado com ID: ${resposta.id}`);
    }

    if (interaction.isButton() && interaction.customId === 'entrar_pt') {
        const pt = fogueirasAtivas.get(interaction.message.id);
        if (!pt) return interaction.reply({ content: '❌ Squad expirado.', flags: MessageFlags.Ephemeral });

        const userIdNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (pt.jogadoresAtuais.includes(userIdNormalizado)) return interaction.reply({ content: '⚠️ Você já está no squad!', flags: MessageFlags.Ephemeral });
        if (pt.jogadoresAtuais.length >= 4) return interaction.reply({ content: '🛑 Squad cheio!', flags: MessageFlags.Ephemeral });

        if (!pt.participantes.includes(userIdNormalizado)) {
            pt.participantes.push(userIdNormalizado);
            console.log(`📝 Botão: ${userIdNormalizado} adicionado aos participantes permanentes`);
        }
        
        pt.jogadoresAtuais.push(userIdNormalizado);
        console.log(`👥 Botão: ${userIdNormalizado} adicionado aos jogadores atuais`);
        
        await atualizarMensagemSquad(interaction.message.id, pt, client);
        
        const membro = interaction.member;
        const canalCall = await interaction.guild.channels.fetch(pt.callId);
        
        if (membro.voice.channelId !== pt.callId) {
            try {
                await membro.voice.setChannel(canalCall);
                await interaction.reply({ content: `✅ Você foi movido para a call <#${pt.callId}>!`, flags: MessageFlags.Ephemeral });
            } catch (e) {
                await interaction.reply({ content: `✅ Você foi adicionado ao squad! Entre na call <#${pt.callId}> manualmente.`, flags: MessageFlags.Ephemeral });
            }
        } else {
            await interaction.reply({ content: `✅ Você já está na call! Squad atualizado.`, flags: MessageFlags.Ephemeral });
        }
    }

    if (interaction.isButton() && interaction.customId === 'cancelar_pt') {
        const pt = fogueirasAtivas.get(interaction.message.id);
        if (!pt) return interaction.reply({ content: '❌ Já finalizado.', flags: MessageFlags.Ephemeral });
        
        const liderNormalizado = pt.liderId;
        const userNormalizado = normalizarUsuarioId(interaction.user.id);
        
        if (userNormalizado !== liderNormalizado) return interaction.reply({ content: '❌ Apenas o líder pode finalizar o squad!', flags: MessageFlags.Ephemeral });

        console.log(`🏁 Squad finalizado manualmente pelo líder. Participantes: ${pt.participantes.join(', ')}`);
        await enviarLog(pt, client);

        const embedFinalizado = EmbedBuilder.from(interaction.message.embeds[0])
            .setTitle('🛑 SQUAD FINALIZADO')
            .setColor('#555555') 
            .setFooter({ text: 'Squad finalizado pelo líder.' });

        await interaction.message.edit({ embeds: [embedFinalizado], components: [] }).catch(() => null);

        fogueirasAtivas.delete(interaction.message.id);
        await interaction.reply({ content: '✅ Squad finalizado com sucesso! Log registrado.', flags: MessageFlags.Ephemeral });
    }
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promessa rejeitada não tratada:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
});

// =======================================================
// SERVIDOR WEB (API) PARA RECEBER O AVISO DO SITE P100
// =======================================================
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); 
app.use(express.json());

app.post('/api/p100-aprovado', async (req, res) => {
    const { discord_id, character, player_name, proof_url, message, char_url } = req.body;

    try {
        const GUILD_ID = '1171347483545313331';
        const CANAL_GALERIA_ID = '1502828353818857564';
        const CARGO_P100_ID = '1492692303293317150';

        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return res.status(500).send({ error: 'Servidor não encontrado.' });

        const member = await guild.members.fetch(discord_id).catch(() => null);
        if (member) {
            await member.roles.add(CARGO_P100_ID).catch(console.error);
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎉 NOVO P100: ${player_name}!`)
            .setDescription(`A Entidade está orgulhosa! O jogador alcançou o Prestígio 100 com **${character}**.`)
            .setColor('#FFD700')
            .setImage(proof_url)
            .addFields(
                { name: 'Mensagem do Jogador', value: message || 'A fumaça levou as palavras...', inline: false }
            )
            .setFooter({ text: 'DbD Galeria de Honra P100' })
            .setTimestamp();

        if (char_url) embed.setThumbnail(char_url);

        const canal = guild.channels.cache.get(CANAL_GALERIA_ID);
        if (canal) {
            await canal.send({ 
                content: member ? `<@${discord_id}>` : `**${player_name}**`,
                embeds: [embed] 
            });
        }

        res.status(200).send({ success: true });
    } catch (error) {
        console.error('❌ Erro no Webhook P100:', error);
        res.status(500).send({ error: 'Erro interno' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🌐 API Web rodando na porta ${PORT} para escutar o site!`);
});

setInterval(() => {
    console.log('💓 Heartbeat enviado em', new Date().toISOString());
}, 5 * 60 * 1000);

console.log('⏳ Conectando à Entidade...');
client.login(process.env.TOKEN);