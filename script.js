/**
 * AI业务天赋速测系统 - 前端交互脚本（V2 重构版）
 * 固定6道精准题目，不含任何评分逻辑，全部交给后端AI两步判定
 */

// ==================== 题目定义（固定题目，不随机） ====================

var QUESTIONS = [
    { id: 1, dim: '本质导向', text: '一家开了十年的社区面馆，口味不错，但近半年生意下滑。老板觉得是附近新开了三家面馆抢了客人。如果你是他，你会先怀疑哪个自己店里的根本问题？（提示：不是口味、价格、服务）' },
    { id: 2, dim: '强逻辑',   text: '你接手一家业绩下滑的门店，老板给了一堆杂乱信息。你第一步会怎么组织这些信息，让自己心里有数？请用"第一步...第二步...第三步..."的结构回答。' },
    { id: 3, dim: '体系重构', text: '如果让你全权改革一个传统公司的业务流程，你第一刀会砍掉哪个环节？为什么非砍它不可？' },
    { id: 4, dim: '街头洞察', text: '你最近一次在线下消费时，有没有哪个细节让你觉得"这老板很会做生意"？描述一下那个细节。' },
    { id: 5, dim: '效率杠杆', text: '如果现在有一个重复性极高的任务（比如整理一千份杂乱表格），你会怎么处理？（提示：是否会用工具或自动化？）描述你的大致思路。' },
    { id: 6, dim: '附加挑战', text: '一家开在老小区的社区食堂，主打低价便民，但经营了三年始终微利。老板想在不提高价格、不降低分量的前提下，把利润翻一倍。如果你来操盘，核心思路是什么？' }
];

// 维度名映射表
var DIM_LABELS = {
    essence:    '本质导向',
    logic:      '强逻辑',
    rebuild:    '体系重构',
    street:     '街头洞察',
    efficiency: '效率杠杆',
    allrounder: '全能验证'
};

var DIM_ICONS = {
    essence:    'fa-bullseye',
    logic:      'fa-project-diagram',
    rebuild:    'fa-tools',
    street:     'fa-store',
    efficiency: 'fa-bolt',
    allrounder: 'fa-crown'
};

// ==================== 状态 ====================
var lastResults = null;

// ==================== 工具函数 ====================

function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}

function getAnswer(n) {
    var el = document.getElementById('answer_' + n);
    return el ? el.value.trim() : '';
}

function getPhone() {
    var el = document.getElementById('contact_phone');
    return el ? el.value.trim() : '';
}

// ==================== 进度条 ====================

function updateProgress() {
    var total = 7; // 6题 + 手机号
    var filled = 0;
    for (var i = 1; i <= 6; i++) {
        if (getAnswer(i).length > 0) filled++;
    }
    if (getPhone().length > 0) filled++;

    var pct = Math.round((filled / total) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressText').textContent = filled + ' / ' + total;
}

// ==================== 高亮 ====================

function clearHighlights() {
    var cards = document.querySelectorAll('.question-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('highlighted');
    }
}

function highlightCard(cardId) {
    var card = document.getElementById(cardId);
    if (card) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ==================== 提交到后端 ====================

async function submitToBackend() {
    clearHighlights();

    // 逐题校验
    for (var i = 1; i <= 6; i++) {
        if (!getAnswer(i)) {
            alert('请完成第 ' + i + ' 题后再提交');
            highlightCard('card_q' + i);
            document.getElementById('answer_' + i).focus();
            return;
        }
    }

    // 校验手机号
    var phone = getPhone();
    if (!phone) {
        alert('请填写手机号以便后续联系');
        highlightCard('card_phone');
        document.getElementById('contact_phone').focus();
        return;
    }
    if (!validatePhone(phone)) {
        alert('请填写正确的11位手机号码');
        highlightCard('card_phone');
        document.getElementById('contact_phone').focus();
        return;
    }

    // 构造 payload
    var answers = [];
    for (var j = 1; j <= 6; j++) {
        answers.push({
            questionId: j,
            question: QUESTIONS[j - 1].text,
            answer: getAnswer(j)
        });
    }

    var payload = { phone: phone, answers: answers };

    // 显示加载
    document.getElementById('loadingArea').style.display = 'block';
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('submitTest').disabled = true;

    try {
        var response = await fetch('/.netlify/functions/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('服务器返回错误: ' + response.status);

        var results = await response.json();
        lastResults = results;
        lastResults._phone = phone;
        lastResults._answers = answers;

        displayResults(results);
        submitToNetlifyForms(payload, results);

    } catch (error) {
        console.error('提交失败:', error);
        alert('分析请求失败，请稍后再试。错误: ' + error.message);
    } finally {
        document.getElementById('loadingArea').style.display = 'none';
        document.getElementById('submitTest').disabled = false;
    }
}

// ==================== 提交到 Netlify Forms ====================

function submitToNetlifyForms(payload, results) {
    try {
        var fd = new URLSearchParams();
        fd.append('form-name', 'quiz-submissions');
        fd.append('phone', payload.phone);

        for (var i = 0; i < payload.answers.length; i++) {
            fd.append('q' + (i + 1), payload.answers[i].question);
            fd.append('a' + (i + 1), payload.answers[i].answer);
        }

        fd.append('totalScore', String(results.totalScore));
        fd.append('level', results.level);
        fd.append('label', results.label);
        fd.append('path', results.path);
        fd.append('dimensions', JSON.stringify(results.dimensions));
        fd.append('evaluation', results.evaluation);
        fd.append('timestamp', new Date().toLocaleString('zh-CN'));

        fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: fd.toString()
        }).catch(function(err) {
            console.log('Netlify Forms 提交备份失败:', err);
        });
    } catch (e) {
        console.log('表单数据构造失败:', e);
    }
}

// ==================== 展示结果 ====================

function displayResults(r) {
    // 等级 & 标签 & 路径
    document.getElementById('resultLevel').textContent = r.level;
    document.getElementById('resultLabel').textContent = r.label;
    document.getElementById('resultPath').textContent = r.path;

    // 总分
    document.getElementById('totalScore').textContent = r.totalScore;

    // 五维 + 全能卡片
    var grid = document.getElementById('dimensionsGrid');
    grid.innerHTML = '';

    var dimKeys = ['essence', 'logic', 'rebuild', 'street', 'efficiency', 'allrounder'];
    for (var i = 0; i < dimKeys.length; i++) {
        var key = dimKeys[i];
        var val = r.dimensions[key];
        var isPass = val === true;
        var isAllrounder = key === 'allrounder';

        var card = document.createElement('div');
        card.className = 'dim-card' + (isAllrounder ? ' allrounder-card' : '');

        card.innerHTML =
            '<div class="dim-icon ' + (isPass ? 'pass' : 'fail') + '">' +
                '<i class="fas ' + (isPass ? 'fa-check' : 'fa-times') + '"></i>' +
            '</div>' +
            '<div class="dim-info">' +
                '<div class="dim-name">' + (DIM_LABELS[key] || key) + '</div>' +
                '<div class="dim-result ' + (isPass ? 'pass' : 'fail') + '">' +
                    (isPass ? '达标' : '未达标') +
                    (isAllrounder && isPass ? ' - 全能型' : '') +
                '</div>' +
            '</div>';

        grid.appendChild(card);
    }

    // AI 评语
    document.getElementById('evaluationText').textContent = r.evaluation;

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
    var r = lastResults;
    var phone = r._phone || '未填写';
    var dims = r.dimensions;

    var report =
        'AI业务天赋速测 - 分析报告\n' +
        '=========================================\n' +
        '测试时间: ' + new Date().toLocaleString() + '\n' +
        '联系方式: ' + phone + '\n\n' +
        '等级: ' + r.level + '\n' +
        '标签: ' + r.label + '\n' +
        '推荐路径: ' + r.path + '\n' +
        '加权总分: ' + r.totalScore + ' / 8\n\n' +
        '五维判定:\n' +
        '  本质导向: ' + (dims.essence ? '达标' : '未达标') + '\n' +
        '  强逻辑:   ' + (dims.logic ? '达标' : '未达标') + '\n' +
        '  体系重构: ' + (dims.rebuild ? '达标' : '未达标') + '\n' +
        '  街头洞察: ' + (dims.street ? '达标' : '未达标') + '\n' +
        '  效率杠杆: ' + (dims.efficiency ? '达标' : '未达标') + '\n' +
        '  全能验证: ' + (dims.allrounder ? '达标' : '未达标') + '\n\n' +
        'AI天赋速评:\n' + r.evaluation + '\n\n' +
        '=========================================\n' +
        '注：课程顾问将在24小时内通过电话 ' + phone + ' 与您联系。\n';

    var blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'AI业务天赋测评报告_' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== 重置 ====================

function resetTest() {
    for (var i = 1; i <= 6; i++) {
        var el = document.getElementById('answer_' + i);
        if (el) el.value = '';
    }
    var phoneEl = document.getElementById('contact_phone');
    if (phoneEl) phoneEl.value = '';

    lastResults = null;
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('loadingArea').style.display = 'none';
    clearHighlights();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    updateProgress();

    document.getElementById('submitTest').addEventListener('click', submitToBackend);
    document.getElementById('resetTest').addEventListener('click', resetTest);
    document.getElementById('downloadReport').addEventListener('click', downloadReport);
    document.getElementById('startNewTest').addEventListener('click', function() {
        if (confirm('确定要重新测评吗？当前答案将清空。')) resetTest();
    });
});
