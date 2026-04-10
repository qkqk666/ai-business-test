/**
 * AI业务天赋速测系统 - 前端交互脚本
 * 注意：本文件不包含任何评分算法，评分由后端云函数完成
 */

// ==================== 题库（题目本身不需要保密） ====================

const basicQuestionsPool = [
    "你家楼下小吃店生意很冷清，你觉得可能有哪些原因？",
    "一家水果店位置好但生意差，可能的原因有哪些？",
    "社区超市客流越来越少，可能有哪些原因？",
    "一家早餐店口味不错但生意不好，可能的原因有哪些？",
    "一家网店有流量，但没人下单，你觉得问题大概出在哪？",
    "淘宝店铺有访客但转化率低，问题出在哪些环节？",
    "微信公众号有阅读量但没咨询，问题可能出在哪？",
    "直播带货有人看但没人买，问题可能出在哪里？",
    "如果让你帮一家小店多赚点钱，你第一步会先做什么？",
    "如何帮助一家理发店增加收入，你的第一步行动是什么？",
    "提升一家书店的销售额，你第一步会关注什么？",
    "帮一家健身房增加会员，你第一步会先调查什么？",
    "让你一整天重复做同一件简单小事（复制粘贴、抄东西等），你的真实感受是什么？",
    "每天机械地整理数据表格8小时，你的真实想法是？",
    "每天重复拨打推销电话100个，你的真实感受是？",
    "让你一周都做同样的数据录入工作，你的真实想法是？",
    "别人告诉你「这事就按老方法做，别问为什么」，你心里会怎么想？",
    "领导让你照搬竞争对手的方案，你内心会怎么想？",
    "同事说「别多想，按我说的做就行」，你心里会怎么想？",
    "老板要求无条件执行旧流程，你内心会怎么想？",
    "遇到一个你不会的事情，你一般会怎么处理？",
    "面对完全没接触过的工作任务，你通常怎么应对？",
    "工作中遇到完全陌生的软件工具，你会怎么处理？",
    "面对一个全新的行业知识，你一般会怎么学习？",
    "如果你有5件重要任务但只有时间完成3件，你会怎么选择？",
    "当多个任务同时需要你处理时，你的优先顺序是什么？",
    "如何判断一个任务是否值得投入大量时间？",
    "有1000元预算要提升小店生意，你会怎么分配？",
    "如果只能投入时间和金钱中的一种来解决问题，你选哪个？",
    "如何在有限资源下最大化商业效果？",
    "用非常规方法解决一个常见商业问题，你的思路是？",
    "如何用10元钱创造100元的价值？",
    "传统行业+新技术，能碰撞出什么新机会？",
    "一个新商业机会有高收益高风险，你如何决策？",
    "如何判断一个商业想法是否可行？",
    "面对不确定的市场变化，你的应对策略是什么？",
    "团队成员不认可你的方案，你会怎么处理？",
    "如何让不熟悉的团队快速理解你的商业思路？",
    "为什么有些产品很好但用户不买账？",
    "用户说'贵'的时候，真正在意的是什么？"
];

const advancedQuestionsPool = [
    "同一条小吃街，你家和对面店完全一样，对面还天天恶意截流抢客，你一分钱预算都没有，要求7天内客流反超对面30%，你会怎么做？",
    "同一商场内，你的服装店和对面店完全相同，对面天天打折促销还雇人拉客，你没有额外预算，要求一周内销量反超对面50%，你的具体策略是什么？",
    "一家垂直品类网店，精准流量拉满、详情页完美、价格合理、好评率99%、无竞品打压，但就是90%访客只逛不买，最核心的底层本质问题是什么？",
    "一个知识付费产品，精准用户流量充足、课程内容优质、价格适中、讲师专业，但就是付费转化率极低，最本质的问题是什么？",
    "一个成熟业务系统，每个环节都看似完美但整体效率低下，如何找到瓶颈点？",
    "如何用AI优化一个传统行业的完整业务流程？",
    "在红海市场中如何找到蓝海机会？",
    "如何用颠覆性思维解决行业痛点？",
    "设计一个零成本启动的商业模式",
    "如何将线下传统业务转型为线上数字业务？",
    "如何在7天内零预算获取1000个精准用户？",
    "如何设计自传播的增长引擎？",
    "有一堆用户行为数据，如何从中发现商业机会？",
    "如何用数据驱动业务决策？",
    "如何用现有资源撬动更大商业价值？",
    "在资源极度有限情况下如何破局？"
];

// ==================== 状态管理 ====================

let currentBasicQuestions = [];
let currentAdvancedQuestions = [];
let userAnswers = {};
let lastResults = null;

// ==================== 工具函数 ====================

/**
 * Fisher-Yates 洗牌算法（真正的等概率随机）
 */
function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
    return a;
}

/**
 * 从题库中随机抽取题目，自动排除上一轮已出过的题
 * @param {Array} pool       - 全部题库
 * @param {number} count     - 要抽几道
 * @param {Array} exclude    - 要排除的题目（上一轮的题）
 */
function getRandomQuestions(pool, count, exclude) {
    // 先把上一轮的题从候选中去掉
    var available = pool.filter(function(q) {
        return exclude.indexOf(q) === -1;
    });
    // 如果排除后剩余不够抽，就用全部题库
    if (available.length < count) {
        available = pool.slice();
    }
    var shuffled = shuffleArray(available);
    return shuffled.slice(0, count);
}

function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}

// ==================== 题目生成 ====================

function generateBasicQuestions() {
    var container = document.getElementById('basicQuestions');
    container.innerHTML = '';
    // 传入当前题目作为排除项，保证换题一定出新题
    currentBasicQuestions = getRandomQuestions(basicQuestionsPool, 4, currentBasicQuestions);

    currentBasicQuestions.forEach(function(question, index) {
        var questionId = 'basic_' + index;
        var card = document.createElement('div');
        card.className = 'question-card';
        card.id = 'card_basic_' + index;
        card.innerHTML =
            '<div class="question-header">' +
                '<div class="question-type basic">题 ' + (index + 1) + '</div>' +
            '</div>' +
            '<div class="question-text">' + question + '</div>' +
            '<textarea id="' + questionId + '" class="answer-input" rows="3" placeholder="简单回答即可" oninput="updateProgress()">' +
                (userAnswers[questionId] || '') +
            '</textarea>' +
            '<div class="compact-hint">按真实想法回答</div>';
        container.appendChild(card);
    });
    updateProgress();
}

function generateContactQuestion() {
    var container = document.getElementById('contactQuestion');
    container.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'question-card';
    card.id = 'card_contact';
    card.innerHTML =
        '<div class="question-header">' +
            '<div class="question-type contact">联系方式</div>' +
        '</div>' +
        '<div class="question-text">请留下您的手机号，方便我们后续与您联系沟通详细培养方案：</div>' +
        '<input type="tel" id="contact_phone" class="answer-input phone-input" placeholder="请输入11位手机号码" oninput="updateProgress()" value="' + (userAnswers['contact_phone'] || '') + '">' +
        '<div class="compact-hint">仅用于后续课程咨询，我们不会泄露您的个人信息</div>';
    container.appendChild(card);
    updateProgress();
}

function generateAdvancedQuestions() {
    var container = document.getElementById('advancedQuestions');
    container.innerHTML = '';
    // 传入当前题目作为排除项
    currentAdvancedQuestions = getRandomQuestions(advancedQuestionsPool, 1, currentAdvancedQuestions);

    currentAdvancedQuestions.forEach(function(question, index) {
        var questionId = 'advanced_' + index;
        var card = document.createElement('div');
        card.className = 'question-card';
        card.id = 'card_advanced_' + index;
        card.innerHTML =
            '<div class="question-header">' +
                '<div class="question-type advanced">进阶题</div>' +
            '</div>' +
            '<div class="question-text">' + question + '</div>' +
            '<textarea id="' + questionId + '" class="answer-input" rows="4" placeholder="展现深度思考" oninput="updateProgress()">' +
                (userAnswers[questionId] || '') +
            '</textarea>' +
            '<div class="compact-hint">考察深度商业洞察</div>';
        container.appendChild(card);
    });
    updateProgress();
}

// ==================== 进度条 ====================

function updateProgress() {
    saveCurrentAnswers();
    var answeredCount = 0;
    var totalQuestions = 6;

    for (var i = 0; i < 4; i++) {
        var el = document.getElementById('basic_' + i);
        if (el && el.value.trim().length > 0) answeredCount++;
    }
    var phoneEl = document.getElementById('contact_phone');
    if (phoneEl && phoneEl.value.trim().length > 0) answeredCount++;
    var advEl = document.getElementById('advanced_0');
    if (advEl && advEl.value.trim().length > 0) answeredCount++;

    var progress = (answeredCount / totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    return answeredCount;
}

function saveCurrentAnswers() {
    for (var i = 0; i < 4; i++) {
        var el = document.getElementById('basic_' + i);
        if (el) userAnswers['basic_' + i] = el.value;
    }
    var phoneEl = document.getElementById('contact_phone');
    if (phoneEl) userAnswers['contact_phone'] = phoneEl.value;
    var advEl = document.getElementById('advanced_0');
    if (advEl) userAnswers['advanced_0'] = advEl.value;
}

function clearQuestionAnswers() {
    for (var i = 0; i < 4; i++) delete userAnswers['basic_' + i];
    delete userAnswers['advanced_0'];
}

// ==================== 高亮未答题卡片 ====================

function clearAllHighlights() {
    var cards = document.querySelectorAll('.question-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].style.borderLeftColor = '';
    }
}

function highlightCard(cardId) {
    var card = document.getElementById(cardId);
    if (card) {
        card.style.borderLeftColor = '#f94144';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==================== 提交到后端 ====================

async function submitToBackend() {
    saveCurrentAnswers();
    clearAllHighlights();

    // ---- 逐项检查，精确提示哪道题没答 ----

    // 检查基础题
    for (var i = 0; i < 4; i++) {
        var answer = (userAnswers['basic_' + i] || '').trim();
        if (!answer) {
            alert('请完成第 ' + (i + 1) + ' 题基础题后再提交');
            highlightCard('card_basic_' + i);
            var el = document.getElementById('basic_' + i);
            if (el) el.focus();
            return;
        }
    }

    // 检查手机号
    var phone = (userAnswers['contact_phone'] || '').trim();
    if (!phone) {
        alert('请填写手机号以便我们后续与您联系');
        highlightCard('card_contact');
        document.getElementById('contact_phone').focus();
        return;
    }
    if (!validatePhone(phone)) {
        alert('请填写正确的11位手机号码');
        highlightCard('card_contact');
        document.getElementById('contact_phone').focus();
        return;
    }

    // 检查进阶题
    var advAnswer = (userAnswers['advanced_0'] || '').trim();
    if (!advAnswer) {
        alert('请完成进阶挑战题后再提交');
        highlightCard('card_advanced_0');
        var advEl = document.getElementById('advanced_0');
        if (advEl) advEl.focus();
        return;
    }

    // ---- 全部通过，构造发送给后端的数据 ----
    var payload = {
        phone: phone,
        basicAnswers: [],
        advancedAnswers: []
    };

    for (var j = 0; j < 4; j++) {
        payload.basicAnswers.push({
            question: currentBasicQuestions[j] || '',
            answer: (userAnswers['basic_' + j] || '').trim()
        });
    }
    payload.advancedAnswers.push({
        question: currentAdvancedQuestions[0] || '',
        answer: advAnswer
    });

    // 显示加载状态
    document.getElementById('loadingArea').style.display = 'block';
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('submitTest').disabled = true;

    try {
        var response = await fetch('/.netlify/functions/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('服务器返回错误: ' + response.status);
        }

        var results = await response.json();
        lastResults = results;
        lastResults._phone = phone;
        lastResults._payload = payload;

        displayResults(results);

        // ---- 提交数据到 Netlify Forms（后台收集） ----
        submitToNetlifyForms(payload, results);

    } catch (error) {
        console.error('提交失败:', error);
        alert('分析请求失败，请稍后再试。错误: ' + error.message);
    } finally {
        document.getElementById('loadingArea').style.display = 'none';
        document.getElementById('submitTest').disabled = false;
    }
}

// ==================== 数据收集：提交到 Netlify Forms ====================

function submitToNetlifyForms(payload, results) {
    try {
        var formData = new URLSearchParams();
        formData.append('form-name', 'quiz-submissions');

        // 手机号
        formData.append('phone', payload.phone);

        // 4道基础题的题目+答案
        for (var i = 0; i < payload.basicAnswers.length; i++) {
            formData.append('basic-q' + (i + 1), payload.basicAnswers[i].question);
            formData.append('basic-a' + (i + 1), payload.basicAnswers[i].answer);
        }

        // 进阶题
        if (payload.advancedAnswers.length > 0) {
            formData.append('advanced-q1', payload.advancedAnswers[0].question);
            formData.append('advanced-a1', payload.advancedAnswers[0].answer);
        }

        // 评分结果
        formData.append('totalScore', String(results.totalScore));
        formData.append('dimensions', JSON.stringify(results.dimensions));
        formData.append('talentTags', results.talentTags.join(', '));
        formData.append('className', results.classRecommendation.name);
        formData.append('talentSummary', results.talentSummary);
        formData.append('timestamp', new Date().toLocaleString('zh-CN'));

        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        }).catch(function(err) {
            console.log('Netlify Forms 提交备份失败（不影响用户体验）:', err);
        });
    } catch (e) {
        console.log('表单数据构造失败:', e);
    }
}

// ==================== 展示结果 ====================

function displayResults(results) {
    // 总分
    document.getElementById('totalScore').textContent = results.totalScore;

    // 五维分数
    document.getElementById('logicScore').textContent = results.dimensions.logic + '/3 分';
    document.getElementById('businessScore').textContent = results.dimensions.business + '/3 分';
    document.getElementById('efficiencyScore').textContent = results.dimensions.efficiency + '/3 分';
    document.getElementById('criticalScore').textContent = results.dimensions.critical + '/3 分';
    document.getElementById('strategyScore').textContent = results.dimensions.strategy + '/3 分';

    // 天赋标签
    var tagsEl = document.getElementById('talentTags');
    tagsEl.innerHTML = '';
    var tagColors = {
        '底层逻辑猎手型': 'talent-tag-1',
        '街头商业洞察型': 'talent-tag-2',
        '反规效率优化型': 'talent-tag-3',
        '叛逆质疑型思考者': 'talent-tag-4',
        '游戏策略思维型': 'talent-tag-5'
    };
    results.talentTags.forEach(function(tag) {
        var cls = tagColors[tag] || 'talent-tag-2';
        tagsEl.innerHTML += '<span class="talent-tag ' + cls + '">' + tag + '</span> ';
    });

    // 天赋总结
    document.getElementById('talentSummary').textContent = results.talentSummary;

    // 班级推荐
    var rec = results.classRecommendation;
    var classEl = document.getElementById('classRecommendation');
    classEl.innerHTML =
        '<div class="criteria-card ' + rec.color + '" style="margin-top:0;">' +
            '<div class="criteria-header">' +
                '<div class="criteria-title">' + rec.name + '</div>' +
                '<div class="price-tag">推荐</div>' +
            '</div>' +
            '<p style="margin:0.8rem 0;font-size:0.9rem;">' + rec.desc + '</p>' +
            '<p style="font-size:0.85rem;"><i class="' + rec.icon + '"></i> <strong>路径：</strong>' + rec.action + '</p>' +
        '</div>';

    // 显示结果
    document.getElementById('resultArea').style.display = 'block';
    document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth' });
}

// ==================== 下载报告 ====================

function downloadReport() {
    if (!lastResults) {
        alert('请先完成测试再下载报告');
        return;
    }

    var phone = lastResults._phone || '未填写';
    var r = lastResults;

    var report =
        'AI业务天赋速测 - 分析报告\n' +
        '测试时间: ' + new Date().toLocaleString() + '\n' +
        '联系方式: ' + phone + '\n' +
        '综合得分: ' + r.totalScore + '/10\n\n' +
        '详细分析:\n' +
        '1. 逻辑深度: ' + r.dimensions.logic + '/3\n' +
        '2. 商业嗅觉: ' + r.dimensions.business + '/3\n' +
        '3. 效率驱动: ' + r.dimensions.efficiency + '/3\n' +
        '4. 质疑精神: ' + r.dimensions.critical + '/3\n' +
        '5. 策略思维: ' + r.dimensions.strategy + '/3\n\n' +
        '天赋标签: ' + r.talentTags.join(', ') + '\n\n' +
        '天赋总结:\n' + r.talentSummary + '\n\n' +
        '推荐班级: ' + r.classRecommendation.name + '\n\n' +
        '注：我们的课程顾问将在24小时内通过电话 ' + phone + ' 与您联系。\n';

    var blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'AI业务天赋测试报告_' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== 重置 ====================

function resetTest() {
    userAnswers = {};
    lastResults = null;
    generateBasicQuestions();
    generateContactQuestion();
    generateAdvancedQuestions();
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('loadingArea').style.display = 'none';
    clearAllHighlights();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startNewTest() {
    if (confirm('确定要开始新的测试吗？当前答案将丢失。')) {
        resetTest();
    }
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    generateBasicQuestions();
    generateContactQuestion();
    generateAdvancedQuestions();

    // 换题按钮：不需要 confirm，直接换（体验更流畅）
    document.getElementById('regenerateQuestions').addEventListener('click', function() {
        // 清空当前题目答案
        clearQuestionAnswers();
        // 重新生成（会自动排除上一轮的题目）
        generateBasicQuestions();
        generateAdvancedQuestions();
    });

    document.getElementById('submitTest').addEventListener('click', submitToBackend);
    document.getElementById('resetTest').addEventListener('click', resetTest);
    document.getElementById('startNewTest').addEventListener('click', startNewTest);
    document.getElementById('downloadReport').addEventListener('click', downloadReport);

    document.getElementById('toggleCriteria').addEventListener('click', function() {
        var content = document.getElementById('criteriaContent');
        if (content.classList.contains('active')) {
            content.classList.remove('active');
            this.innerHTML = '<h3 style="margin:0;color:var(--primary);font-size:0.95rem;"><i class="fas fa-chevron-down"></i> 分班标准（点击展开）</h3>';
        } else {
            content.classList.add('active');
            this.innerHTML = '<h3 style="margin:0;color:var(--primary);font-size:0.95rem;"><i class="fas fa-chevron-up"></i> 分班标准（点击收起）</h3>';
        }
    });
});
