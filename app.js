// Принудительная темная тема для всех браузеров
(function() {
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Дополнительная защита для Safari
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        const style = document.createElement('style');
        style.textContent = `
            :root { color-scheme: dark !important; }
            select, input, textarea { color-scheme: dark !important; }
        `;
        document.head.appendChild(style);
    }
})();

// Глобальные переменные
let progressChart = null;
let volumeChart = null;
let radarChart = null;
let restTimer = null;
let currentTimerSeconds = 0;
let currentEditingTrainingId = null;
let currentExerciseInput = null;
let suggestionsTimeout = null;
let selectedMuscleGroups = [];
let statsCurrentTab = 'overview';
let newExercisesData = [];
let exerciseMuscleGroups = {};

// ФИКС ДЛЯ IOS СКРОЛЛА В МОДАЛКЕ
function initIOSScrollFix() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        // Предотвращаем скролл body когда модалка открыта
        document.body.addEventListener('touchmove', function(e) {
            const modal = document.getElementById('new-exercises-modal');
            if (modal && modal.style.display === 'flex') {
                // Разрешаем скролл только внутри модального контента
                if (!e.target.closest('.modal-content')) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }
}

// Функция для авто-выделения текста в полях весов и подходов
function initAutoSelect() {
    document.addEventListener('focusin', function(e) {
        const target = e.target;
        
        // Только поля весов и подходов в силовых упражнениях
        if (target.matches('.set input[type="number"]') || 
            target.matches('.set-edit-input')) {
            
            setTimeout(() => {
                target.select();
            }, 10);
        }
    });
}

// Вызываем инициализацию при загрузке
document.addEventListener('DOMContentLoaded', initIOSScrollFix);

// Кэш для оптимизации
const StatsCache = {
    personalRecords: null,
    lastCalculation: null,
    muscleLoad: null,
    exerciseEffectiveness: null
};

// Функция для показа уведомлений
function showAlert(message, type = 'info') {
    // Создаем элемент уведомления
    const alert = document.createElement('div');
    
    // Определяем отступ сверху в зависимости от устройства
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const topOffset = isIOS ? '80px' : '20px'; // Для iOS сдвигаем ниже
    
    alert.style.cssText = `
        position: fixed;
        top: ${topOffset};
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#6bcf7f' : '#00d4aa'};
        color: ${type === 'error' ? 'white' : 'black'};
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
        max-width: 90%;
        text-align: center;
        word-wrap: break-word;
    `;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        alert.style.animation = 'slideUp 0.3s ease-in';
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 3000);
}

// БАЗА УПРАЖНЕНИЙ
// БАЗА УПРАЖНЕНИЙ + СИСТЕМА ПОЛЬЗОВАТЕЛЬСКИХ УПРАЖНЕНИЙ
const exerciseDatabase = {
    // Бицепс и Предплечья
    'Сгибания рук в запястьях': ['forearms'],
    'Сгибания рук в запястьях со штангой хватом сверху': ['forearms'],
    'Подъем штанги на бицепс обратным хватом': ['forearms', 'biceps'],
    'Концентрированный подъем на бицепс': ['biceps'],
    'Сгибание рук на бицепс в кроссовере': ['biceps'],
    'Подъем на бицепс в блочном тренажере стоя': ['biceps', 'forearms'],
    'Подъем гантелей на бицепс в скамье Скотта': ['biceps'],
    'Подъем EZ-штанги на бицепс в скамье Скотта': ['biceps'],
    'Молоток': ['biceps', 'forearms'],
    'Подъем гантелей на бицепс сидя': ['biceps', 'forearms'],
    'Подъемы гантелей на бицепс стоя': ['biceps'],
    'Подъем штанги на бицепс стоя': ['biceps'],
    'Подъем штанги на бицепс с EZ-грифом': ['biceps'],
    'Подъем на бицепс на блоке с канатной рукоятью': ['biceps'],
    '"Паучьи" сгибания (Spider Curls)': ['biceps'],
    'Сгибания Зоттмана (Zottman Curl)': ['biceps', 'forearms'],
    'Удержание блинов (Farmers Hold)': ['forearms', 'traps'],

    // Трицепс
    'Разгибания руки с гантелью в наклоне': ['triceps'],
    'Разгибание руки с гантелью из-за головы': ['triceps'],
    'Жим книзу одной рукой обратным хватом': ['triceps'],
    'Жим к низу в блочном тренажере': ['triceps'],
    'Французский жим в тренажере сидя': ['triceps'],
    'Французский жим EZ-штанги сидя': ['triceps'],
    'Французский жим лежа': ['triceps'],
    'Французский жим стоя': ['triceps'],
    'Французский жим с гантелями': ['triceps'],
    'Отжимания от скамьи': ['triceps'],
    'Жим штанги узким хватом лежа': ['triceps', 'chest', 'shoulders'],
    'Отжимания от пола узким хватом': ['triceps', 'chest'],
    'Алмазные отжимания (Diamond Push-Ups)': ['triceps', 'chest'],
    'Разгибания рук из-за головы с канатной рукоятью': ['triceps'],
    'Отжимания в гравитроне': ['triceps', 'chest'],
    'Обратные отжимания от скамьи': ['triceps'],

    // Пресс и Косые
    'Косые скручивания': ['obliques'],
    'Подъемы ног в висе': ['abs'],
    'Подъемы коленей в висе': ['abs'],
    'Подъем ног в висе на турнике': ['abs'],
    'Обратные скручивания': ['abs'],
    'Скручивание на коленях в блочном тренажере': ['abs', 'obliques'],
    'Скручивания на скамье с наклоном вниз': ['abs'],
    'Скручивание на римском стуле': ['abs'],
    'Планка': ['abs', 'back'],
    'Боковая планка': ['obliques', 'abs'],
    'Скручивания с верхнего блока на коленях': ['abs'],
    'Русские скручивания': ['obliques', 'abs'],
    'Велосипед': ['abs', 'obliques'],
    'Вакуум (Stomach Vacuum)': ['abs'],
    'Скручивания с роликом (Ab Wheel Rollout)': ['abs', 'back', 'shoulders'],
    'Упражнение "Дровосек" (Wood Choppers) на блоке': ['obliques', 'abs'],
    'Планка с подтягиванием колена': ['abs', 'obliques'],

    // Трапеции
    'Тяга штанги к подбородку': ['shoulders', 'traps'],
    'Тяга штанги к подбородку широким хватом': ['shoulders', 'traps'],
    'Шраги с гантелями': ['traps'],
    'Шраги со штангой за спиной': ['traps'],
    'Шраги со штангой': ['traps'],
    'Шраги с гантелями лежа на наклонной скамье': ['traps'],
    'Шраги на тренажере для икр': ['traps'],
    'Прогулка фермера': ['traps', 'forearms', 'legs', 'abs'],

    // Грудь
    'Сведение в кроссовере через нижние блоки': ['chest', 'shoulders'],
    'Сведение в кроссовере через верхние блоки': ['chest'],
    'Кроссоверы на блокас в наклоне': ['chest'],
    'Сведения в тренажере Peck-Deck': ['chest'],
    'Разведение гантелей на скамье с наклоном вверх': ['chest'],
    'Разведение гантелей лежа': ['chest'],
    'Жим от груди в тренажере сидя': ['chest'],
    'Жим гантелей на скамье с наклоном вниз': ['chest'],
    'Жим гантелей на скамье с наклоном вверх': ['chest'],
    'Жим гантелей лежа': ['chest'],
    'Жим штанги на скамье с наклоном вниз': ['chest'],
    'Жим штанги на скамье с наклоном': ['chest'],
    'Жим штанги лежа': ['chest'],
    'Жим в тренажере Смита': ['chest'],
    'Жим гантелей на полу (Floor Press)': ['chest', 'triceps'],
    'Отжимания на брусьях (с наклоном вперед)': ['chest', 'triceps'],
    'Отжимания от пола с широкой постановкой рук': ['chest'],
    'Жим в хаммере': ['chest'],
    'Кроссоверы через верхние блоки': ['chest'],
    'Пек-дек (бабочка)': ['chest'],
    'Пуловер с гантелью лежа': ['chest', 'back'],

    // Плечи (Дельты)
    'Жим штанги стоя (армейский жим)': ['shoulders'],
    'Жим штанги сидя': ['shoulders'],
    'Жим гантелей сидя': ['shoulders'],
    'Жим гантелей стоя': ['shoulders'],
    'Жим Арнольда': ['shoulders'],
    'Жим гантелей над головой попеременно': ['shoulders', 'core'],
    'Подъем гантелей над головой через стороны': ['shoulders'],
    'Разведение гантелей стоя': ['shoulders'],
    'Подъем гантелей перед собой': ['shoulders'],
    'Подъем рук перед собой с пластиной': ['shoulders'],
    'Разведение гантелей в наклоне': ['shoulders'],
    'Махи гантелями в стороны в наклоне сидя': ['shoulders'],
    'Обратные разведения в тренажере Peck-Deck': ['shoulders'],
    'Тяга Ли Хейни': ['shoulders', 'back'],
    'Подъем рук с гантелями в стороны в наклоне': ['shoulders'],
    'Швунг жимовой': ['shoulders', 'legs'],
    'Face Pull (Тяга к лицу с канатом)': ['shoulders', 'back'],

    // Спина
    'Наклоны со штангой на плечах': ['back', 'glutes', 'hamstrings'],
    'Становая тяга': ['back', 'legs', 'glutes'],
    'Становая тяга Сумо': ['back', 'legs', 'glutes'],
    'Пуловер в блочном тренажере стоя': ['back', 'chest'],
    'Горизонтальная тяга в блочном тренажере': ['back'],
    'Вертикальная тяга обратным хватом': ['back'],
    'Вертикальная тяга широким хватом': ['back'],
    'Тяга гантели одной рукой в наклоне': ['back'],
    'Тяга Т-штанги': ['back'],
    'Тяга штанги в наклоне обратным хватом': ['back'],
    'Тяга штанги в наклоне': ['back'],
    'Подтягивания на перекладине': ['back'],
    'Подтягивания широким хватом за голову': ['back'],
    'Подтягивания обратным хватом': ['back', 'biceps'],
    'Тяга верхнего блока широким хватом': ['back'],
    'Тяга нижнего блока к поясу сидя': ['back'],
    'Тяга гири одной рукой': ['back'],
    'Тяга гири к поясу двумя руками ("Медведь")': ['back'],
    'Австралийские подтягивания': ['back'],
    'Тяга Рейдера (Raider Pull)': ['back'],
    'Пуловер с гантелью на скамье': ['back', 'chest'],

    // Ноги и Ягодицы
    'Подъемы на носки сидя': ['calves'],
    'Подъемы на носки в тренажере для жимов ногами': ['calves'],
    'Подъемы на носки стоя': ['calves'],
    'Подъем на носки в тренажере сидя': ['calves'],
    'Подъем на носки стоя в тренажере': ['calves'],
    'Подъем на носки в Гакк-тренажере': ['calves'],
    'Сгибания ног сидя': ['legs'],
    'Сгибания ног стоя': ['legs'],
    'Сгибание ног лежа': ['legs'],
    'Гиперэкстензия для мышц бедра': ['glutes', 'legs', 'hamstrings'],
    'Румынский подъем': ['hamstrings', 'legs', 'glutes'],
    'Становая тяга на прямых ногах': ['hamstrings', 'legs', 'glutes'],
    'Румынская становая тяга с гантелями': ['hamstrings', 'legs', 'glutes'],
    '"Позер" или "Доброе утро" со штангой': ['hamstrings', 'glutes', 'back'],
    'Рывок штанги на грудь': ['legs', 'back', 'shoulders'],
    'Разгибания ног': ['quads', 'legs'],
    'Вышагивания на платформу': ['glutes', 'legs', 'hamstrings', 'quads'],
    'Зашагивания на скамью с гантелями': ['glutes', 'legs'],
    'Выпады назад': ['quads', 'glutes'],
    'Выпады со штангой': ['glutes', 'legs', 'hamstrings', 'quads'],
    'Болгарские сплит-приседания': ['quads', 'legs', 'glutes'],
    'Жим ногами': ['quads', 'legs', 'hamstrings'],
    'Гакк-приседания': ['quads', 'legs', 'glutes'],
    'Приседания со штангой на груди в тренажере Смита': ['quads', 'legs', 'glutes', 'hamstrings'],
    'Приседания в тренажере Смита': ['quads', 'legs', 'glutes', 'hamstrings'],
    'Приседания со штангой': ['quads', 'legs', 'hamstrings', 'glutes'],
    'Фронтальные приседания': ['quads', 'legs', 'core'],
    'Приседания Джефферсона': ['quads', 'glutes', 'hamstrings'],
    'Приседания "Пистолетик"': ['quads', 'legs', 'glutes'],
    'Приседания с гантелями (кубковый присед)': ['quads', 'legs', 'glutes'],
    'Ягодичный мостик со штангой': ['glutes', 'legs', 'hamstrings'],
    'Ягодичный мостик с гантелью': ['glutes', 'hamstrings'],
    'Подъем таза лежа на полу': ['legs', 'glutes'],
    'Отведения ноги назад в кроссовере': ['glutes'],
    'Разведения ног в тренажере': ['legs'],
    'Сведения ног в тренажере': ['legs'],
    'Приведение ноги в тренажере': ['legs'],
    'Прогулка в сторону с резиной': ['glutes', 'legs'],

    // Функциональные и Упражнения Всего Тела
    'Берпи (Burpee)': ['legs', 'chest', 'shoulders', 'core'],
    'Толчок гири (Kettlebell Swing)': ['hamstrings', 'glutes', 'back', 'shoulders'],
    'Трастеры (со штангой/гантелями)': ['legs', 'shoulders'],
    'Взятие на грудь (Power Clean)': ['legs', 'back', 'shoulders'],
    'Рывок (Snatch)': ['legs', 'back', 'shoulders'],
    'Толчок (Clean & Jerk)': ['legs', 'back', 'shoulders'],
    'Турецкий подъем (Turkish Get-Up)': ['shoulders', 'core', 'legs'],
    'Прогулка фермера с гирями/гантелями': ['traps', 'forearms', 'legs', 'abs']
};

// МЕНЕДЖЕР ПОЛЬЗОВАТЕЛЬСКИХ УПРАЖНЕНИЙ
const UserExerciseManager = {
    // Получить все пользовательские упражнения
    getUserExercises() {
        try {
            return JSON.parse(localStorage.getItem('userExercises') || '{}');
        } catch (error) {
            console.error('Ошибка загрузки пользовательских упражнений:', error);
            return {};
        }
    },

    // Сохранить пользовательские упражнения
    saveUserExercises(exercises) {
        try {
            localStorage.setItem('userExercises', JSON.stringify(exercises));
            return true;
        } catch (error) {
            console.error('Ошибка сохранения пользовательских упражнений:', error);
            return false;
        }
    },

    // Добавить новое пользовательское упражнение
    addUserExercise(exerciseName, muscleGroups) {
        const userExercises = this.getUserExercises();
        if (!userExercises[exerciseName]) {
            userExercises[exerciseName] = {
                groups: muscleGroups,
                icon: '👤',
                type: 'user',
                createdAt: new Date().toISOString()
            };
            return this.saveUserExercises(userExercises);
        }
        return true; // если уже существует - игнорируем (по твоему требованию)
    },

    // Редактировать пользовательское упражнение
    editUserExercise(exerciseName, newMuscleGroups) {
        const userExercises = this.getUserExercises();
        if (userExercises[exerciseName]) {
            userExercises[exerciseName].groups = newMuscleGroups;
            userExercises[exerciseName].updatedAt = new Date().toISOString();
            return this.saveUserExercises(userExercises);
        }
        return false;
    },

    // Удалить пользовательское упражнение
    deleteUserExercise(exerciseName) {
        const userExercises = this.getUserExercises();
        if (userExercises[exerciseName]) {
            delete userExercises[exerciseName];
            return this.saveUserExercises(userExercises);
        }
        return false;
    },

    // Получить ВСЕ упражнения (стандартные + пользовательские)
    getAllExercises() {
        const userExercises = this.getUserExercises();
        const allExercises = { ...exerciseDatabase };
        
        // Добавляем пользовательские упражнения с иконкой
        Object.keys(userExercises).forEach(exerciseName => {
            allExercises[exerciseName] = userExercises[exerciseName].groups;
        });
        
        return allExercises;
    },

    // Получить информацию об упражнении (для отображения иконки)
    getExerciseInfo(exerciseName) {
        const userExercises = this.getUserExercises();
        if (userExercises[exerciseName]) {
            return {
                groups: userExercises[exerciseName].groups,
                icon: '👤',
                type: 'user'
            };
        } else if (exerciseDatabase[exerciseName]) {
            return {
                groups: exerciseDatabase[exerciseName],
                icon: '🏋️',
                type: 'standard'
            };
        }
        return null;
    }
};

// ОТДЕЛЬНАЯ БАЗА КАРДИО УПРАЖНЕНИЙ
const cardioDatabase = {
    // Стандартные упражнения (🏃)
    'Беговая дорожка': { type: 'стандарт', icon: '🏃' },
    'Велотренажер': { type: 'стандарт', icon: '🚴' },
    'Эллипс': { type: 'стандарт', icon: '🔄' },
    'Гребной тренажер': { type: 'стандарт', icon: '🚣' },
    'Скакалка': { type: 'стандарт', icon: '🔄' },
    'Плавание': { type: 'стандарт', icon: '🏊' },
    'Ходьба': { type: 'стандарт', icon: '🚶' },
    'Степпер': { type: 'стандарт', icon: '🔄' },
    'Берпи': { type: 'стандарт', icon: '💥' },
    'Спринты': { type: 'стандарт', icon: '⚡' },
    'Интервальный бег': { type: 'стандарт', icon: '🎯' },
    'Велопрогулка': { type: 'стандарт', icon: '🚲' }
};

// ОТДЕЛЬНЫЕ СИНОНИМЫ ДЛЯ КАРДИО
const cardioSynonyms = {
    'бег': 'Беговая дорожка',
    'беговая': 'Беговая дорожка', 
    'дорожка': 'Беговая дорожка',
    'running': 'Беговая дорожка',
    'тредмил': 'Беговая дорожка',
    'treadmill': 'Беговая дорожка',
    
    'велотренажер': 'Велотренажер',
    'вело': 'Велотренажер',
    'bike': 'Велотренажер', 
    'cycling': 'Велотренажер',
    'сайклинг': 'Велотренажер',
    'велосипед': 'Велотренажер',
    
    'эллипс': 'Эллипс',
    'эллиптический': 'Эллипс',
    'elliptical': 'Эллипс',
    'орбитрек': 'Эллипс',
    
    'гребля': 'Гребной тренажер',
    'гребной': 'Гребной тренажер',
    'rowing machine': 'Гребной тренажер',
    
    'разминка': 'Ходьба',
    'заминка': 'Ходьба', 
    'кардио': 'Беговая дорожка',
    'cardio': 'Беговая дорожка',
    'аэробная': 'Беговая дорожка',
    'пробежка': 'Беговая дорожка',
    'прыжки': 'Скакалка',
    'скакалка': 'Скакалка'
};

// МЕНЕДЖЕР ПОЛЬЗОВАТЕЛЬСКИХ КАРДИО
const UserCardioManager = {
    // Получить все пользовательские упражнения
    getUserCardioExercises() {
        try {
            return JSON.parse(localStorage.getItem('userCardioExercises') || '{}');
        } catch (error) {
            console.error('Ошибка загрузки пользовательских кардио:', error);
            return {};
        }
    },

    // Сохранить пользовательские упражнения
    saveUserCardioExercises(exercises) {
        try {
            localStorage.setItem('userCardioExercises', JSON.stringify(exercises));
            return true;
        } catch (error) {
            console.error('Ошибка сохранения пользовательских кардио:', error);
            return false;
        }
    },

    // Добавить новое пользовательское упражнение
    addUserCardioExercise(exerciseName) {
        const userExercises = this.getUserCardioExercises();
        if (!userExercises[exerciseName]) {
            userExercises[exerciseName] = { type: 'пользователь', icon: '👤' };
            return this.saveUserCardioExercises(userExercises);
        }
        return true;
    },

    // Получить ВСЕ кардио упражнения (стандартные + пользовательские)
    getAllCardioExercises() {
        const userExercises = this.getUserCardioExercises();
        return { ...cardioDatabase, ...userExercises };
    },

    // Проверить похожесть упражнений
    findSimilarExercises(searchTerm) {
        const allExercises = this.getAllCardioExercises();
        const normalizedSearch = searchTerm.toLowerCase().trim();
        
        return Object.keys(allExercises).filter(exercise => {
            const normalizedExercise = exercise.toLowerCase();
            return normalizedExercise.includes(normalizedSearch) || 
                   normalizedSearch.includes(normalizedExercise);
        });
    }
};

// Маппинг групп мышц
const muscleGroupMapping = {
    // Основные группы (есть в мышечной карте)
    'chest': 'Грудь',
    'back': 'Спина', 
    'legs': 'Ноги',
    'shoulders': 'Плечи',
    'biceps': 'Бицепс',
    'triceps': 'Трицепс',
    'abs': 'Пресс',
    'traps': 'Трапеции',
    'calves': 'Икры',
    'cardio': 'Кардио',
    'forearms': 'Предплечья',  // Как в твоей карте!
    
    // Дополнительные группы для аналитики (будут группироваться)
    'glutes': 'Ягодицы',
    'quads': 'Квадрицепсы',
    'hamstrings': 'Бицепс бедра', 
    'obliques': 'Косые',
    'core': 'Пресс'
};

// Переменные для модального окна
let currentExercisesDataForModal = null;
let modalSelectedMuscleGroups = [];

// Библиотека мотивационных фраз
const motivationPhrases = [
    "Сегодня отличный день прокачать грудь! 💪",
    "Пора сделать спину шире! 📏",
    "День ног - основа твоей силы! 🦵", 
    "Плечи как скалы сегодня! 🎯",
    "Бицепсы ждут своего часа! 💪",
    "Время для рельефного пресса! 🔥",
    "Трицепс - залог массивных рук! 🔻",
    "Каждая тренировка приближает к цели! 🚀",
    "Ты сильнее, чем думаешь! 💫",
    "Пот сегодня - результат завтра! 🌟",
    "Не пропускай - тело скажет спасибо! 🙏",
    "Маленькие шаги к большой цели! 👣",
    "Дисциплина > мотивации! ⚡",
    "Бро отложил пончик - пора в зал! 🍩",
    "Твой будущий я уже благодарит! 🙏",
    "Жим лежа не ждет! 🏋️",
    "Присед или нет? Ответ всегда ДА! ✅",
    "Летний сезон близко - время действовать! ☀️",
    "Осенний набор - зимний рельеф! 🍂",
    "Зимой растем - весной блистаем! ❄️"
];

// Умные фразы по дням недели
const dayPhrases = {
    1: ["Понедельник - день груди и амбиций! 💥", "Начни неделю с мощной тренировки! 🚀"],
    2: ["Вторник - спина и сила воли! 🎯", "Сильная спина - основа прогресса! 🔥"],
    3: ["Среда - ноги и стойкость! 🏋️", "Приседания ждут тебя! 💪"],
    4: ["Четверг - плечи и мощь! 💫", "Широкие плечи никогда не выходят из моды! 🎯"],
    5: ["Пятница - руки и решимость! 🔥", "Заканчивай неделю с рельефными руками! 💪"],
    6: ["Суббота - пресс и выносливость! ⚡", "Уикенд - не повод пропускать тренировку! 🌟"],
    0: ["Воскресенье - планируй новую неделю! 📋", "Отдыхай и готовься к новым победам! 🙏"]
};

// Умный выбор фразы
function getSmartMotivation() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    let timeBasedPhrases = [];
    if (hour >= 5 && hour < 12) {
        timeBasedPhrases = ["Утренняя тренировка зарядит на весь день! ☀️", "Начни день с победы над собой! 💥"];
    } else if (hour >= 12 && hour < 18) {
        timeBasedPhrases = ["Дневная тренировка - перезагрузка для ума и тела! 🔄", "Время поднять энергию! ⚡"];
    } else {
        timeBasedPhrases = ["Вечерняя тренировка снимет стресс дня! 🌙", "Заверши день на высокой ноте! 🎵"];
    }
    
    const availablePhrases = [
        ...(dayPhrases[dayOfWeek] || []),
        ...timeBasedPhrases,
        ...motivationPhrases
    ];
    
    return availablePhrases[Math.floor(Math.random() * availablePhrases.length)];
}

// Смена фразы с анимацией
function showNewMotivation() {
    const motivationElement = document.getElementById('motivation-text');
    if (!motivationElement) return;
    
    motivationElement.style.opacity = '0';
    
    setTimeout(() => {
        const newPhrase = getSmartMotivation();
        motivationElement.textContent = newPhrase;
        motivationElement.style.opacity = '0.9';
    }, 300);
}

// Инициализация мотивации при загрузке приложения
function initMotivation() {
    const motivationElement = document.getElementById('motivation-text');
    if (motivationElement) {
        motivationElement.textContent = getSmartMotivation();
        
        document.querySelector('.header').addEventListener('click', function() {
            showNewMotivation();
        });
    }
}

// Инициализация приложения
function initApp() {
    console.log("🚀 Инициализация приложения...");
    
    // Устанавливаем имя пользователя
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = 'Друг';
    }
    
    // Инициализируем основные функции
    initCommonFeatures();
    
    // Инициализируем мотивационную систему
    initMotivation();
    
    // Инициализируем авто-выделение текста для весов и подходов ← ДОБАВЬ ЭТУ СТРОЧКУ
    initAutoSelect();
    
    console.log("✅ Приложение запущено!");
}

function initCommonFeatures() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    document.getElementById('training-date').value = localDate.toISOString().split('T')[0];
    
    initTabs();
    initMuscleGroupsSelect();
    initSmartRecommendations();
    addExercise();
    initCharts();
    initAutocomplete();
    initMuscleMap();
      
    console.log("✅ Приложение запущено!");
}

// МЫШЕЧНАЯ КАРТА
function initMuscleMap() {
    const muscleMapTab = document.querySelector('[data-tab="muscle-map"]');
    if (muscleMapTab) {
        muscleMapTab.addEventListener('click', loadMuscleMap);
    }
}

function loadMuscleMap() {
    updateMuscleMapTitle();
    const muscleStatus = calculateLastWeekMuscleStatus();
    updateMuscleMapColors(muscleStatus);
}

function updateMuscleMapTitle() {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 9); // 10 дней включая сегодня
    
    const titleElement = document.getElementById('muscle-map-title');
    if (titleElement) {
        const startStr = startDate.toLocaleDateString('ru-RU');
        const endStr = now.toLocaleDateString('ru-RU');
        titleElement.textContent = `Карта нагрузки с ${startStr} по ${endStr}`;
    }
}

function calculateLastWeekMuscleStatus() {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 9); // 10 дней включая сегодня
    startDate.setHours(0, 0, 0, 0);

    console.log("📅 Анализ 10 дней:", startDate.toLocaleDateString('ru-RU'), "-", endDate.toLocaleDateString('ru-RU'));

    const trainings = DataManager.getTrainings().filter(t => {
        const trainingDate = new Date(t.date);
        return trainingDate >= startDate && trainingDate <= endDate;
    });

    console.log("🏋️ Найдено тренировок за 10 дней:", trainings.length);

    const muscleStats = {};
    
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            const exerciseName = exercise.name.trim();
            const muscleGroups = autoDetectMuscleGroups(exerciseName);
            const workingSets = exercise.sets.filter(set => set.weight > 0 && set.reps > 0);
            
            if (muscleGroups.length > 0 && workingSets.length > 0) {
                console.log(`➡️ ${exerciseName}: ${muscleGroups.join(', ')} - ${workingSets.length} подходов`);
                
                const setsPerMuscle = workingSets.length / muscleGroups.length;
                
                muscleGroups.forEach(muscle => {
                    const targetMuscle = groupMuscles(muscle);
                    
                    if (!muscleStats[targetMuscle]) {
                        muscleStats[targetMuscle] = 0;
                    }
                    muscleStats[targetMuscle] += setsPerMuscle;
                });
            }
        });
    });

    const muscleStatus = {};
    const mainMuscleGroups = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'traps', 'calves', 'forearms'];

    mainMuscleGroups.forEach(muscle => {
        const setsCount = muscleStats[muscle] || 0;
        const roundedSets = Math.round(setsCount * 10) / 10;
        
        let status;
        if (setsCount === 0) {
            status = 'untrained';
        } else if (setsCount >= 25) {
            status = 'overtraining';
        } else if (setsCount >= 8) {
            status = 'optimal';
        } else {
            status = 'undertrained';
        }

        muscleStatus[muscle] = status;
        
        console.log(`💪 ${muscle}: ${roundedSets} подходов - ${status}`);
    });

    return muscleStatus;
}

function groupMuscles(muscle) {
    const muscleGroups = {
        // Группируем только те мышцы, которых НЕТ в твоей мышечной карте
        'glutes': 'legs',        // Ягодицы → Ноги
        'quads': 'legs',         // Квадрицепсы → Ноги  
        'hamstrings': 'legs',    // Бицепс бедра → Ноги
        'obliques': 'abs',       // Косые → Пресс
        'core': 'abs',           // Core → Пресс
        
        // Остальные группы остаются как есть (есть в твоей карте)
        'chest': 'chest',
        'back': 'back',
        'shoulders': 'shoulders', 
        'biceps': 'biceps',
        'triceps': 'triceps',
        'abs': 'abs',
        'traps': 'traps',
        'calves': 'calves',
        'forearms': 'forearms'    // forearms → forearm (как в твоей карте)
    };
    
    return muscleGroups[muscle] || muscle;
}

function updateMuscleMapColors(muscleStatus) {
    let updatedCount = 0;
    
    Object.entries(muscleStatus).forEach(([muscle, status]) => {
        const muscleElement = document.getElementById(muscle);
        if (muscleElement && muscleElement.classList.contains('muscle-area')) {
            muscleElement.classList.remove('untrained', 'undertrained', 'optimal', 'overtraining');
            muscleElement.classList.add(status);
            updatedCount++;
        }
    });
    
    console.log(`🎨 Обновлено мышц: ${updatedCount}`);
    
    if (updatedCount > 0) {
        showMuscleMapNotification(muscleStatus);
    }
}

function showMuscleMapNotification(muscleStatus) {
    const stats = {
        untrained: 0,
        undertrained: 0,
        optimal: 0,
        overtraining: 0
    };
    
    Object.values(muscleStatus).forEach(status => {
        stats[status]++;
    });
    
    const message = `📊 Статус мышц за 10 дней: ✅ ${stats.optimal} норм | ⚠️ ${stats.undertrained} мало | 🔴 ${stats.overtraining} перегруз | ⚫ ${stats.untrained} не трен`;
    console.log(message);
}

// КОМБО-ВЫБОР ГРУПП МЫШЦ
function initMuscleGroupsSelect() {
    const display = document.getElementById('selected-groups-display');
    const dropdown = document.getElementById('muscle-groups-dropdown');
    
    const newDisplay = display.cloneNode(true);
    display.parentNode.replaceChild(newDisplay, display);
    
    const updatedDisplay = document.getElementById('selected-groups-display');
    const updatedDropdown = document.getElementById('muscle-groups-dropdown');
    const checkboxes = updatedDropdown.querySelectorAll('input[type="checkbox"]');
    
    updatedDisplay.addEventListener('click', function(e) {
        e.stopPropagation();
        updatedDropdown.classList.toggle('show');
        updatedDisplay.classList.toggle('active');
    });
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectedGroups();
            updateExercisePlaceholders();
            showSmartRecommendations();
        });
    });
    
    document.addEventListener('click', function(e) {
        if (!updatedDropdown.contains(e.target) && !updatedDisplay.contains(e.target)) {
            updatedDropdown.classList.remove('show');
            updatedDisplay.classList.remove('active');
        }
    });
}

function updateExercisePlaceholders() {
    const exerciseInputs = document.querySelectorAll('.exercise-name');
    const placeholder = selectedMuscleGroups.length === 0 
        ? 'Название упражнения (выберите группы мышц для подсказок)'
        : 'Название упражнения';
    
    exerciseInputs.forEach(input => {
        if (!input.value.trim()) {
            input.placeholder = placeholder;
        }
    });
}

function updateSelectedGroups() {
    const checkboxes = document.querySelectorAll('#muscle-groups-dropdown input[type="checkbox"]:checked');
    selectedMuscleGroups = Array.from(checkboxes).map(cb => cb.value);
    
    const display = document.getElementById('selected-groups-display');
    const hiddenInput = document.getElementById('training-type');
    
    if (selectedMuscleGroups.length === 0) {
        display.textContent = 'Выберите группы мышц';
        hiddenInput.value = '';
    } else {
        const selectedNames = Array.from(checkboxes).map(cb => cb.dataset.name);
        display.textContent = selectedNames.join(' + ');
        hiddenInput.value = selectedMuscleGroups.join(',');
    }
    
    // Обновляем плейсхолдеры упражнений
    updateExercisePlaceholders();
    
    // Обновляем рекомендации
    showSmartRecommendations();
}

// =============================================
// НОВЫЕ ФУНКЦИИ ДЛЯ МОДАЛЬНОГО ОКНА УПРАЖНЕНИЙ
// =============================================

// Функция показа модального окна для новых упражнений

function debugMuscleGroups() {
    console.log("=== DEBUG MUSCLE GROUPS ===");
    console.log("1. currentExercisesDataForModal:", currentExercisesDataForModal);
    
    if (currentExercisesDataForModal && currentExercisesDataForModal.exercises) {
        console.log("2. Exercises in modal data:");
        currentExercisesDataForModal.exercises.forEach((exercise, index) => {
            const allExercises = UserExerciseManager.getAllExercises();
            console.log(`   ${index + 1}. ${exercise.name}:`, allExercises[exercise.name]);
        });
    }
    
    console.log("3. selectedMuscleGroups:", selectedMuscleGroups);
    console.log("4. exerciseMuscleGroups:", exerciseMuscleGroups);
    console.log("5. Has cardio:", currentExercisesDataForModal?.cardio?.length > 0);
    console.log("========================");
}

function showNewExercisesModal(unknownExercises, unknownCardio = []) {
    console.log("🔧 ОТКРЫВАЕМ МОДАЛКУ:", { unknownExercises, unknownCardio });
    
    const modal = document.getElementById('new-exercises-modal');
    const exercisesList = document.getElementById('new-exercises-list');
    
    // Блокируем скролл body
    document.body.classList.add('modal-open');
    
    // Инициализация данных
    newExercisesData = [...unknownExercises, ...unknownCardio.map(cardio => ({ ...cardio, type: 'cardio' }))];
    exerciseMuscleGroups = {};
    
    // Инициализируем пустые группы для каждого неизвестного упражнения
    unknownExercises.forEach(exercise => {
        exerciseMuscleGroups[exercise.name] = [];
    });
    
    // Для кардио автоматически ставим группу 'cardio'
    unknownCardio.forEach(cardio => {
        exerciseMuscleGroups[cardio.name] = ['cardio'];
    });
    
    // СРАЗУ определяем группы для известных упражнений
    if (currentExercisesDataForModal && currentExercisesDataForModal.exercises) {
        currentExercisesDataForModal.exercises.forEach(exercise => {
            const allExercises = UserExerciseManager.getAllExercises();
            if (allExercises[exercise.name]) {
                exerciseMuscleGroups[exercise.name] = [...allExercises[exercise.name]];
            }
        });
    }
    
    if (newExercisesData.length > 0) {
        exercisesList.innerHTML = newExercisesData.map((exercise, index) => {
            const isCardio = exercise.type === 'cardio';
            
            return `
                <div class="new-exercise-item" style="margin-bottom: 20px; padding: 15px; background: #2a2a2a; border-radius: 10px; border: 1px solid #404040;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 18px; margin-right: 10px;">${isCardio ? '🏃' : '🏋️'}</span>
                        <span style="font-weight: 600; font-size: 16px; color: white;">${exercise.name}</span>
                        ${isCardio ? '<span style="margin-left: 10px; background: #00d4aa; color: black; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">КАРДИО</span>' : ''}
                    </div>
                    
                    ${isCardio ? `
                        <div style="font-size: 13px; color: #90cdf4; margin-bottom: 12px;">
                            💡 Это кардио упражнение будет автоматически добавлено в вашу базу
                        </div>
                    ` : `
                        <div style="font-size: 13px; color: #a0aec0; margin-bottom: 12px;">
                            Выберите группы мышц для этого упражнения:
                        </div>
                        
                        <div class="muscle-groups-checkboxes" id="groups-${index}" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${getMuscleGroupsCheckboxes(exercise.name, index)}
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }
    
    // ПОКАЗЫВАЕМ МОДАЛКУ
    modal.style.display = 'flex';
    
    // ФИКС ДЛЯ IOS: Даем время на рендеринг
    setTimeout(() => {
        updateTrainingGroupsSummary();
        
        // Прокручиваем немного вниз чтобы показать что есть контент
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody && modalBody.scrollHeight > modalBody.clientHeight) {
            modalBody.scrollTop = 10;
        }
    }, 100);
}

function getMuscleGroupIcon(muscleGroup) {
    const icons = {
        'chest': '💪',
        'back': '📏', 
        'legs': '🦵',
        'shoulders': '🎯',
        'biceps': '💪',
        'triceps': '🔻',
        'abs': '🔥',
        'traps': '📐',
        'calves': '🦶',
        'forearms': '🤲',
        'cardio': '🏃',
        'glutes': '🍑',
        'quads': '🦵',
        'hamstrings': '🦵',
        'obliques': '🔥',
        'core': '🔥'
    };
    
    return icons[muscleGroup] || '🏋️';
}

function updateTrainingGroupsSummary() {
    console.log("🔄 ОБНОВЛЯЕМ СВОДКУ ГРУПП...");
    
    const summaryContainer = document.getElementById('selected-groups-display-modal');
    if (!summaryContainer) {
        console.log("❌ Контейнер сводки не найден!");
        return;
    }
    
    // Собираем ВСЕ группы мышц из тренировки:
    const allGroups = new Set();
    
    // 1. Группы из выбранных вверху (комбо-селектор)
    console.log("📌 Выбранные группы:", selectedMuscleGroups);
    selectedMuscleGroups.forEach(group => allGroups.add(group));
    
    // 2. Группы из ВСЕХ известных упражнений в тренировке
    if (currentExercisesDataForModal && currentExercisesDataForModal.exercises) {
        console.log("📌 Упражнения в тренировке:", currentExercisesDataForModal.exercises);
        
        currentExercisesDataForModal.exercises.forEach(exercise => {
            // Проверяем как известные упражнения (из базы)
            const allExercises = UserExerciseManager.getAllExercises();
            console.log(`🔍 Проверяем упражнение: ${exercise.name}`, allExercises[exercise.name]);
            
            if (allExercises[exercise.name]) {
                // Это известное упражнение - берем группы из базы
                console.log(`✅ Известное упражнение: ${exercise.name} -> группы:`, allExercises[exercise.name]);
                allExercises[exercise.name].forEach(group => allGroups.add(group));
            }
            // Неизвестные упражнения обрабатываются в пункте 3
        });
    }
    
    // 3. Группы из выбранных в модалке для новых упражнений
    console.log("📌 Группы из модалки:", exerciseMuscleGroups);
    Object.values(exerciseMuscleGroups).forEach(groups => {
        groups.forEach(group => allGroups.add(group));
    });
    
    // 4. Если есть кардио в тренировке - добавляем группу "кардио"
    if (currentExercisesDataForModal && currentExercisesDataForModal.cardio && currentExercisesDataForModal.cardio.length > 0) {
        console.log("📌 Есть кардио упражнения");
        allGroups.add('cardio');
    }
    
    const groupsArray = Array.from(allGroups).filter(group => group && group !== 'other');
    console.log("📊 ИТОГОВЫЕ ГРУППЫ:", groupsArray);
    
    if (groupsArray.length === 0) {
        summaryContainer.innerHTML = '<span style="color: #a0aec0; font-size: 14px;">Группы мышц появятся после выбора...</span>';
        return;
    }
    
    // Сортируем группы для красивого отображения
    const sortedGroups = groupsArray.sort((a, b) => {
        const order = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'traps', 'calves', 'forearms', 'cardio'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    
    summaryContainer.innerHTML = sortedGroups.map(group => `
        <span style="display: inline-flex; align-items: center; background: #00d4aa; color: black; padding: 8px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 2px;">
            ${getMuscleGroupIcon(group)} ${muscleGroupMapping[group] || group}
        </span>
    `).join('');
    
    console.log("✅ Отобразили группы:", sortedGroups);
}

function updateExerciseGroups(exerciseName, muscleGroup, isChecked) {
    console.log(`🔄 Обновляем группы для ${exerciseName}: ${muscleGroup} = ${isChecked}`);
    
    if (!exerciseMuscleGroups[exerciseName]) {
        exerciseMuscleGroups[exerciseName] = [];
    }
    
    if (isChecked) {
        if (!exerciseMuscleGroups[exerciseName].includes(muscleGroup)) {
            exerciseMuscleGroups[exerciseName].push(muscleGroup);
        }
    } else {
        exerciseMuscleGroups[exerciseName] = exerciseMuscleGroups[exerciseName].filter(
            group => group !== muscleGroup
        );
    }
    
    console.log(`📝 Новые группы для ${exerciseName}:`, exerciseMuscleGroups[exerciseName]);
    
    // ОБНОВЛЯЕМ ОБЩИЕ ГРУППЫ ТРЕНИРОВКИ
    updateTrainingGroupsSummary();
}

function saveNewExercises() {
    console.log("💾 СОХРАНЯЕМ НОВЫЕ УПРАЖНЕНИЯ...");
    
    // Проверяем, что у всех СИЛОВЫХ упражнений есть выбранные группы
    const exercisesWithoutGroups = newExercisesData.filter(
        exercise => exercise.type !== 'cardio' && (!exerciseMuscleGroups[exercise.name] || exerciseMuscleGroups[exercise.name].length === 0)
    );
    
    if (exercisesWithoutGroups.length > 0) {
        const exerciseNames = exercisesWithoutGroups.map(ex => `"${ex.name}"`).join(', ');
        showAlert(`❌ Выберите группы мышц для упражнений: ${exerciseNames}`);
        return;
    }
    
    // Сохраняем упражнения в соответствующие базы
    let allSaved = true;
    
    newExercisesData.forEach(exercise => {
        if (exercise.type === 'cardio') {
            // Сохраняем в пользовательские кардио упражнения
            console.log(`💾 Сохраняем кардио: ${exercise.name}`);
            const success = UserCardioManager.addUserCardioExercise(exercise.name);
            if (!success) allSaved = false;
        } else {
            // Сохраняем в пользовательские силовые упражнения
            console.log(`💾 Сохраняем силовое: ${exercise.name} с группами:`, exerciseMuscleGroups[exercise.name]);
            const success = UserExerciseManager.addUserExercise(
                exercise.name, 
                exerciseMuscleGroups[exercise.name]
            );
            if (!success) allSaved = false;
        }
    });
    
    if (allSaved) {
        closeNewExercisesModal();
        
        // ТЕПЕРЬ СОХРАНЯЕМ ТРЕНИРОВКУ ПОСЛЕ СОХРАНЕНИЯ УПРАЖНЕНИЙ
        if (currentExercisesDataForModal) {
            // Определяем финальные группы для тренировки
            let finalGroups = [...selectedMuscleGroups];
            
            console.log("🔍 Определяем финальные группы...");
            
            // 1. Добавляем группы из известных силовых упражнений
            if (currentExercisesDataForModal.exercises) {
                currentExercisesDataForModal.exercises.forEach(exercise => {
                    const allExercises = UserExerciseManager.getAllExercises();
                    console.log(`🔍 Проверяем ${exercise.name}:`, allExercises[exercise.name]);
                    
                    if (allExercises[exercise.name]) {
                        allExercises[exercise.name].forEach(group => {
                            if (!finalGroups.includes(group)) {
                                console.log(`✅ Добавляем группу ${group} из ${exercise.name}`);
                                finalGroups.push(group);
                            }
                        });
                    }
                });
            }
            
            // 2. Добавляем группы из новых силовых упражнений
            Object.entries(exerciseMuscleGroups).forEach(([exerciseName, groups]) => {
                // Проверяем, что это не кардио
                const isCardio = newExercisesData.some(ex => ex.name === exerciseName && ex.type === 'cardio');
                if (!isCardio) {
                    groups.forEach(group => {
                        if (!finalGroups.includes(group)) {
                            console.log(`✅ Добавляем группу ${group} из нового упражнения ${exerciseName}`);
                            finalGroups.push(group);
                        }
                    });
                }
            });
            
            // 3. Добавляем кардио если есть (любые кардио упражнения)
            const hasAnyCardio = (currentExercisesDataForModal.cardio && currentExercisesDataForModal.cardio.length > 0) || 
                                newExercisesData.some(ex => ex.type === 'cardio');
            
            if (hasAnyCardio && !finalGroups.includes('cardio')) {
                console.log("✅ Добавляем кардио");
                finalGroups.push('cardio');
            }
            
            // 4. Добавляем группы из комбо-селектора
            selectedMuscleGroups.forEach(group => {
                if (!finalGroups.includes(group)) {
                    console.log(`✅ Добавляем группу ${group} из комбо-селектора`);
                    finalGroups.push(group);
                }
            });
            
            // Убираем дубликаты
            finalGroups = [...new Set(finalGroups)];
            
            console.log("📊 ФИНАЛЬНЫЕ ГРУППЫ ДЛЯ СОХРАНЕНИЯ:", finalGroups);
            
            // Если все еще нет групп - используем автоматически определенные
            if (finalGroups.length === 0) {
                const detectedGroups = detectMuscleGroupsForAllExercises();
                console.log("⚠️ Группы не найдены, используем автоопределение:", detectedGroups);
                finalGroups = detectedGroups.length > 0 ? detectedGroups : ['other'];
            }
            
            // СОХРАНЯЕМ ТРЕНИРОВКУ В ИСТОРИЮ
            const trainingData = {
                date: document.getElementById('training-date').value,
                type: finalGroups,
                exercises: currentExercisesDataForModal.exercises,
                cardio: currentExercisesDataForModal.cardio || []
            };
            
            console.log("💾 Сохраняем тренировку:", trainingData);
            
            const success = DataManager.addTraining(trainingData);
            if (success) {
                showAlert('✅ Тренировка сохранена! Упражнения добавлены в вашу базу.');
                
                // ОЧИСТКА ФОРМЫ
                document.getElementById('exercises-container').innerHTML = '';
                document.getElementById('cardio-container').innerHTML = '';
                selectedMuscleGroups = [];
                updateSelectedGroups();
                updateExercisePlaceholders();
                addExercise();
                
                document.getElementById('auto-fill-message').textContent = '';
                StatsCache.personalRecords = null;
                StatsCache.muscleLoad = null;
                StatsCache.exerciseEffectiveness = null;
                showSmartRecommendations();
                
                // ОБНОВЛЯЕМ ИСТОРИЮ ЕСЛИ АКТИВНА ВКЛАДКА
                if (document.getElementById('history').classList.contains('active')) {
                    loadTrainingHistory();
                }
                
            } else {
                showAlert('❌ Ошибка при сохранении тренировки');
            }
            
            // Очищаем данные модалки
            currentExercisesDataForModal = null;
        }
    } else {
        showAlert('❌ Ошибка при сохранении упражнений');
    }
}

function saveNewExercises() {
    // Проверяем, что у всех упражнений есть выбранные группы
    const exercisesWithoutGroups = newExercisesData.filter(
        exercise => !exerciseMuscleGroups[exercise.name] || exerciseMuscleGroups[exercise.name].length === 0
    );
    
    if (exercisesWithoutGroups.length > 0) {
        const exerciseNames = exercisesWithoutGroups.map(ex => `"${ex.name}"`).join(', ');
        showAlert(`❌ Выберите группы мышц для упражнений: ${exerciseNames}`);
        return;
    }
    
    // Сохраняем упражнения в пользовательскую базу
    let allSaved = true;
    newExercisesData.forEach(exercise => {
        const success = UserExerciseManager.addUserExercise(
            exercise.name, 
            exerciseMuscleGroups[exercise.name]
        );
        if (!success) allSaved = false;
    });
    
    if (allSaved) {
        closeNewExercisesModal();
        
        // ТЕПЕРЬ СОХРАНЯЕМ ТРЕНИРОВКУ ПОСЛЕ СОХРАНЕНИЯ УПРАЖНЕНИЙ
        if (currentExercisesDataForModal) {
            // Определяем финальные группы для тренировки
            let finalGroups = [...selectedMuscleGroups];
            
            // Добавляем группы из известных упражнений
            if (currentExercisesDataForModal.exercises) {
                currentExercisesDataForModal.exercises.forEach(exercise => {
                    const allExercises = UserExerciseManager.getAllExercises();
                    if (allExercises[exercise.name]) {
                        allExercises[exercise.name].forEach(group => {
                            if (!finalGroups.includes(group)) finalGroups.push(group);
                        });
                    }
                });
            }
            
            // Добавляем группы из новых упражнений
            Object.values(exerciseMuscleGroups).forEach(groups => {
                groups.forEach(group => {
                    if (!finalGroups.includes(group)) finalGroups.push(group);
                });
            });
            
            // Добавляем кардио если есть
            if (currentExercisesDataForModal.cardio && currentExercisesDataForModal.cardio.length > 0) {
                if (!finalGroups.includes('cardio')) finalGroups.push('cardio');
            }
            
            // Убираем дубликаты
            finalGroups = [...new Set(finalGroups)];
            
            // Если все еще нет групп - используем автоматически определенные
            if (finalGroups.length === 0) {
                const detectedGroups = detectMuscleGroupsForAllExercises();
                finalGroups = detectedGroups.length > 0 ? detectedGroups : ['other'];
            }
            
            // СОХРАНЯЕМ ТРЕНИРОВКУ В ИСТОРИЮ
            const trainingData = {
                date: document.getElementById('training-date').value,
                type: finalGroups,
                exercises: currentExercisesDataForModal.exercises,
                cardio: currentExercisesDataForModal.cardio || []
            };
            
            const success = DataManager.addTraining(trainingData);
            if (success) {
                showAlert('✅ Тренировка сохранена! Упражнения добавлены в вашу базу.');
                
                // ОЧИСТКА ФОРМЫ
                document.getElementById('exercises-container').innerHTML = '';
                document.getElementById('cardio-container').innerHTML = '';
                selectedMuscleGroups = [];
                updateSelectedGroups();
                updateExercisePlaceholders();
                addExercise();
                
                document.getElementById('auto-fill-message').textContent = '';
                StatsCache.personalRecords = null;
                StatsCache.muscleLoad = null;
                StatsCache.exerciseEffectiveness = null;
                showSmartRecommendations();
                
                // ОБНОВЛЯЕМ ИСТОРИЮ ЕСЛИ АКТИВНА ВКЛАДКА
                if (document.getElementById('history').classList.contains('active')) {
                    loadTrainingHistory();
                }
                
            } else {
                showAlert('❌ Ошибка при сохранении тренировки');
            }
            
            // Очищаем данные модалки
            currentExercisesDataForModal = null;
        }
    } else {
        showAlert('❌ Ошибка при сохранении упражнений');
    }
}

// Генерация чекбоксов для групп мышц
function getMuscleGroupsCheckboxes(exerciseName, index) {
    const muscleGroups = [
        { value: 'chest', name: '💪 Грудь' },
        { value: 'back', name: '📏 Спина' },
        { value: 'legs', name: '🦵 Ноги' },
        { value: 'shoulders', name: '🎯 Плечи' },
        { value: 'biceps', name: '💪 Бицепс' },
        { value: 'triceps', name: '🔻 Трицепс' },
        { value: 'abs', name: '🔥 Пресс' },
        { value: 'traps', name: '📐 Трапеции' },
        { value: 'calves', name: '🦶 Икры' },
        { value: 'forearms', name: '🤲 Предплечья' },
        { value: 'glutes', name: '🍑 Ягодицы' },
        { value: 'cardio', name: '🏃 Кардио' }
    ];
    
    // Получаем уже выбранные группы для этого упражнения
    const selectedGroups = exerciseMuscleGroups[exerciseName] || [];
    console.log(`📝 Группы для ${exerciseName}:`, selectedGroups);
    
    return muscleGroups.map(group => {
        const isChecked = selectedGroups.includes(group.value);
        return `
            <label style="display: flex; align-items: center; padding: 8px; background: #1a1a1a; border-radius: 6px; cursor: pointer; transition: background 0.2s; border: 1px solid #404040;">
                <input type="checkbox" 
                       value="${group.value}" 
                       ${isChecked ? 'checked' : ''}
                       onchange="updateExerciseGroups('${exerciseName}', '${group.value}', this.checked)"
                       style="margin-right: 8px; transform: scale(1.2);">
                <span style="font-size: 14px; color: white;">${group.name}</span>
            </label>
        `;
    }).join('');
}

function updateTrainingGroupsSummary() {
    const summaryContainer = document.getElementById('selected-groups-display-modal');
    if (!summaryContainer) return;
    
    // Собираем ВСЕ группы мышц из тренировки:
    const allGroups = new Set();
    
    // 1. Группы из выбранных вверху (комбо-селектор)
    selectedMuscleGroups.forEach(group => allGroups.add(group));
    
    // 2. Группы из ВСЕХ упражнений в тренировке
    if (currentExercisesDataForModal && currentExercisesDataForModal.exercises) {
        currentExercisesDataForModal.exercises.forEach(exercise => {
            // Проверяем как известные упражнения (из базы)
            const allExercises = UserExerciseManager.getAllExercises();
            if (allExercises[exercise.name]) {
                // Это известное упражнение - берем группы из базы
                allExercises[exercise.name].forEach(group => allGroups.add(group));
            } else {
                // Это неизвестное упражнение - берем группы выбранные в модалке
                const selectedGroups = exerciseMuscleGroups[exercise.name] || [];
                selectedGroups.forEach(group => allGroups.add(group));
            }
        });
    }
    
    // 3. Группы из выбранных в модалке для новых упражнений
    Object.values(exerciseMuscleGroups).forEach(groups => {
        groups.forEach(group => allGroups.add(group));
    });
    
    // 4. Если есть кардио в тренировке - добавляем группу "кардио"
    if (currentExercisesDataForModal && currentExercisesDataForModal.cardio && currentExercisesDataForModal.cardio.length > 0) {
        allGroups.add('cardio');
    }
    
    // 5. Также проверяем, есть ли кардио в выбранных группах
    if (selectedMuscleGroups.includes('cardio')) {
        allGroups.add('cardio');
    }
    
    const groupsArray = Array.from(allGroups).filter(group => group && group !== 'other');
    
    if (groupsArray.length === 0) {
        summaryContainer.innerHTML = '<span style="color: #a0aec0; font-size: 14px;">Группы мышц появятся после выбора...</span>';
        return;
    }
    
    // Сортируем группы для красивого отображения
    const sortedGroups = groupsArray.sort((a, b) => {
        const order = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'traps', 'calves', 'forearms', 'cardio'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    
    summaryContainer.innerHTML = sortedGroups.map(group => `
        <span style="display: inline-flex; align-items: center; background: #00d4aa; color: black; padding: 8px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 2px;">
            ${getMuscleGroupIcon(group)} ${muscleGroupMapping[group] || group}
        </span>
    `).join('');
}

// Обновление выбранных групп для упражнения
function updateExerciseGroups(exerciseName, muscleGroup, isChecked) {
    if (!exerciseMuscleGroups[exerciseName]) {
        exerciseMuscleGroups[exerciseName] = [];
    }
    
    if (isChecked) {
        if (!exerciseMuscleGroups[exerciseName].includes(muscleGroup)) {
            exerciseMuscleGroups[exerciseName].push(muscleGroup);
        }
    } else {
        exerciseMuscleGroups[exerciseName] = exerciseMuscleGroups[exerciseName].filter(
            group => group !== muscleGroup
        );
    }
    
    // ОБНОВЛЯЕМ ОБЩИЕ ГРУППЫ ТРЕНИРОВКИ
    const knownGroups = detectMuscleGroupsForAllExercises();
    updateTrainingGroupsSummary(knownGroups);
}

// Закрытие модального окна
function closeNewExercisesModal() {
    const modal = document.getElementById('new-exercises-modal');
    modal.style.display = 'none';
    newExercisesData = [];
    exerciseMuscleGroups = {};
    
    // Восстанавливаем скролл body
    document.body.classList.remove('modal-open');
    // НЕ очищаем currentExercisesDataForModal и НЕ показываем сообщение здесь
}

function cancelNewExercises() {
    closeNewExercisesModal();
    currentExercisesDataForModal = null;
    showAlert('ℹ️ Сохранение тренировки отменено');
}

// Сохранение новых упражнений
function saveNewExercises() {
    console.log("💾 СОХРАНЯЕМ НОВЫЕ УПРАЖНЕНИЯ...");
    
    // Проверяем, что у всех упражнений есть выбранные группы
    const exercisesWithoutGroups = newExercisesData.filter(
        exercise => !exerciseMuscleGroups[exercise.name] || exerciseMuscleGroups[exercise.name].length === 0
    );
    
    if (exercisesWithoutGroups.length > 0) {
        const exerciseNames = exercisesWithoutGroups.map(ex => `"${ex.name}"`).join(', ');
        showAlert(`❌ Выберите группы мышц для упражнений: ${exerciseNames}`);
        return;
    }
    
    // Сохраняем упражнения в пользовательскую базу
    let allSaved = true;
    newExercisesData.forEach(exercise => {
        console.log(`💾 Сохраняем упражнение: ${exercise.name} с группами:`, exerciseMuscleGroups[exercise.name]);
        const success = UserExerciseManager.addUserExercise(
            exercise.name, 
            exerciseMuscleGroups[exercise.name]
        );
        if (!success) allSaved = false;
    });
    
    if (allSaved) {
        closeNewExercisesModal();
        
        // ТЕПЕРЬ СОХРАНЯЕМ ТРЕНИРОВКУ ПОСЛЕ СОХРАНЕНИЯ УПРАЖНЕНИЙ
        if (currentExercisesDataForModal) {
            // Определяем финальные группы для тренировки
            let finalGroups = [];
            
            console.log("🔍 Определяем финальные группы...");
            
            // 1. Добавляем группы из известных упражнений
            if (currentExercisesDataForModal.exercises) {
                currentExercisesDataForModal.exercises.forEach(exercise => {
                    const allExercises = UserExerciseManager.getAllExercises();
                    console.log(`🔍 Проверяем ${exercise.name}:`, allExercises[exercise.name]);
                    
                    if (allExercises[exercise.name]) {
                        allExercises[exercise.name].forEach(group => {
                            if (!finalGroups.includes(group)) {
                                console.log(`✅ Добавляем группу ${group} из ${exercise.name}`);
                                finalGroups.push(group);
                            }
                        });
                    }
                });
            }
            
            // 2. Добавляем группы из новых упражнений
            Object.values(exerciseMuscleGroups).forEach(groups => {
                groups.forEach(group => {
                    if (!finalGroups.includes(group)) {
                        console.log(`✅ Добавляем группу ${group} из нового упражнения`);
                        finalGroups.push(group);
                    }
                });
            });
            
            // 3. Добавляем кардио если есть
            if (currentExercisesDataForModal.cardio && currentExercisesDataForModal.cardio.length > 0) {
                if (!finalGroups.includes('cardio')) {
                    console.log("✅ Добавляем кардио");
                    finalGroups.push('cardio');
                }
            }
            
            // 4. Добавляем группы из комбо-селектора
            selectedMuscleGroups.forEach(group => {
                if (!finalGroups.includes(group)) {
                    console.log(`✅ Добавляем группу ${group} из комбо-селектора`);
                    finalGroups.push(group);
                }
            });
            
            // Убираем дубликаты
            finalGroups = [...new Set(finalGroups)];
            
            console.log("📊 ФИНАЛЬНЫЕ ГРУППЫ ДЛЯ СОХРАНЕНИЯ:", finalGroups);
            
            // Если все еще нет групп - используем автоматически определенные
            if (finalGroups.length === 0) {
                const detectedGroups = detectMuscleGroupsForAllExercises();
                console.log("⚠️ Группы не найдены, используем автоопределение:", detectedGroups);
                finalGroups = detectedGroups.length > 0 ? detectedGroups : ['other'];
            }
            
            // СОХРАНЯЕМ ТРЕНИРОВКУ В ИСТОРИЮ
            const trainingData = {
                date: document.getElementById('training-date').value,
                type: finalGroups,
                exercises: currentExercisesDataForModal.exercises,
                cardio: currentExercisesDataForModal.cardio || []
            };
            
            console.log("💾 Сохраняем тренировку:", trainingData);
            
            const success = DataManager.addTraining(trainingData);
            if (success) {
                showAlert('✅ Тренировка сохранена! Упражнения добавлены в вашу базу.');
                
                // ОЧИСТКА ФОРМЫ
                document.getElementById('exercises-container').innerHTML = '';
                document.getElementById('cardio-container').innerHTML = '';
                selectedMuscleGroups = [];
                updateSelectedGroups();
                updateExercisePlaceholders();
                addExercise();
                
                document.getElementById('auto-fill-message').textContent = '';
                StatsCache.personalRecords = null;
                StatsCache.muscleLoad = null;
                StatsCache.exerciseEffectiveness = null;
                showSmartRecommendations();
                
                // ОБНОВЛЯЕМ ИСТОРИЮ ЕСЛИ АКТИВНА ВКЛАДКА
                if (document.getElementById('history').classList.contains('active')) {
                    loadTrainingHistory();
                }
                
            } else {
                showAlert('❌ Ошибка при сохранении тренировки');
            }
            
            // Очищаем данные модалки
            currentExercisesDataForModal = null;
        }
    } else {
        showAlert('❌ Ошибка при сохранении упражнений');
    }
}

// Обновляем функцию сохранения тренировки
function saveTraining() {
    // СОБИРАЕМ СИЛОВЫЕ УПРАЖНЕНИЯ
    const exerciseElements = document.querySelectorAll('.exercise');
    let hasValidExercises = false;
    const exercisesData = [];
    const unknownExercises = [];
    
    exerciseElements.forEach(exerciseElement => {
        const exerciseName = exerciseElement.querySelector('.exercise-name').value.trim();
        const sets = [];
        exerciseElement.querySelectorAll('.set').forEach(setElement => {
            const inputs = setElement.querySelectorAll('input[type="number"]');
            const weight = parseInt(inputs[0].value) || 0;
            const reps = parseInt(inputs[1].value) || 0;
            if (weight > 0 && reps > 0) sets.push({ weight, reps });
        });
        
        if (exerciseName && sets.length > 0) {
            exercisesData.push({ name: exerciseName, sets: sets });
            hasValidExercises = true;
            
            // Проверяем, известно ли упражнение (стандартное + пользовательское)
            const allExercises = UserExerciseManager.getAllExercises();
            if (!allExercises[exerciseName]) {
                unknownExercises.push({ name: exerciseName, sets: sets });
            }
        }
    });
    
    // СОБИРАЕМ КАРДИО УПРАЖНЕНИЯ
    const cardioElements = document.querySelectorAll('.cardio-exercise');
    const cardioData = [];
    let hasValidCardio = false;
    const unknownCardio = []; // НОВОЕ: для неизвестных кардио
    
    cardioElements.forEach(cardioElement => {
        const cardioName = cardioElement.querySelector('.cardio-name').value.trim();
        const time = parseInt(cardioElement.querySelector('.cardio-time').value) || 0;
        const intensity = parseInt(cardioElement.querySelector('.cardio-intensity').value) || 0;
        const calories = parseInt(cardioElement.querySelector('.cardio-calories').value) || 0;
        
        if (cardioName && time > 0) {
            cardioData.push({ name: cardioName, time, intensity, calories });
            hasValidCardio = true;
            
            // НОВОЕ: Проверяем, известно ли кардио упражнение
            const allCardio = UserCardioManager.getAllCardioExercises();
            if (!allCardio[cardioName]) {
                unknownCardio.push({ name: cardioName, time, intensity, calories });
            }
        }
    });
    
    // ПРОВЕРКА ЧТО ЕСТЬ ХОТЯ БЫ ОДИН ТИП УПРАЖНЕНИЙ
    if (!hasValidExercises && !hasValidCardio) {
        showAlert('❌ Добавьте хотя бы одно силовое упражнение с подходами ИЛИ кардио упражнение с временем');
        return;
    }
    
    // ЕСЛИ ЕСТЬ НЕИЗВЕСТНЫЕ УПРАЖНЕНИЯ (силовые ИЛИ кардио) - ПОКАЗЫВАЕМ МОДАЛКУ
    if (unknownExercises.length > 0 || unknownCardio.length > 0) {
        currentExercisesDataForModal = { 
            exercises: exercisesData, 
            cardio: cardioData,
            unknownExercises: unknownExercises,
            unknownCardio: unknownCardio // НОВОЕ: передаем неизвестные кардио
        };
        showNewExercisesModal(unknownExercises, unknownCardio); // ОБНОВЛЯЕМ ФУНКЦИЮ
        return;
    }
    
    // ЕСЛИ ВСЕ УПРАЖНЕНИЯ ИЗВЕСТНЫ - СОХРАНЯЕМ АВТОМАТИЧЕСКИ
    const detectedGroups = detectMuscleGroupsForAllExercises();
    let finalGroups = [...detectedGroups];
    
    // ЕСЛИ ЕСТЬ КАРДИО - ДОБАВЛЯЕМ ГРУППУ КАРДИО
    if (hasValidCardio && !finalGroups.includes('cardio')) {
        finalGroups.push('cardio');
    }
    
    // ЕСЛИ ВСЕ ЕЩЕ НЕТ ГРУПП - ИСПОЛЬЗУЕМ ПО УМОЛЧАНИЮ
    if (finalGroups.length === 0) {
        if (hasValidCardio) {
            finalGroups = ['cardio'];
        } else {
            finalGroups = ['other'];
        }
    }
    
    // СОХРАНЯЕМ ТРЕНИРОВКУ
    completeTrainingSave(exercisesData, finalGroups, cardioData);
}

// Обновляем функцию для определения групп мышц
function detectMuscleGroupsForAllExercises() {
    const exerciseElements = document.querySelectorAll('.exercise');
    const detectedGroups = new Set();
    
    exerciseElements.forEach(exerciseElement => {
        const exerciseName = exerciseElement.querySelector('.exercise-name').value.trim();
        if (exerciseName) {
            // Используем улучшенную функцию autoDetectMuscleGroups
            const groups = autoDetectMuscleGroups(exerciseName);
            if (groups.length > 0) {
                groups.forEach(group => detectedGroups.add(group));
            }
        }
    });
    
    return Array.from(detectedGroups);
}

// УМНЫЕ РЕКОМЕНДАЦИИ
function initSmartRecommendations() {
    showSmartRecommendations();
}

function showSmartRecommendations() {
    const container = document.getElementById('smart-recommendations');
    
    if (selectedMuscleGroups.length > 0) {
        const recommendedExercises = getRecommendedExercises(selectedMuscleGroups);
        
        if (recommendedExercises.length > 0) {
            // Определяем количество рядов в зависимости от количества упражнений
            let rowsCount = 2; // по умолчанию 2 ряда
            if (recommendedExercises.length <= 9) {
                rowsCount = 1; // если упражнений мало - 1 ряд
            }
            
            const maxExercises = rowsCount === 1 ? 12 : 18; // ограничиваем количество
            
            const recommendationHTML = `
                <div class="recommendation-section">
                    <h4>💡Нажмите на упражнение для добавления:</h4>
                    <div class="recommended-exercises-list" data-rows="${rowsCount}">
                        ${recommendedExercises.slice(0, maxExercises).map(ex => `
                            <button class="recommended-exercise-btn" onclick="addRecommendedExercise('${ex.replace(/'/g, "\\'")}')">
                                ${ex}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
            container.innerHTML = recommendationHTML;
            
            // Динамически обновляем стили
            updateRecommendationsLayout(rowsCount);
        } else {
            container.innerHTML = `
                <div class="recommendation-hint">
                    <p>🎯 Для выбранных групп упражнений не найдено</p>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div class="recommendation-hint">
                <p>🎯 Выберите группы мышц для получения рекомендаций</p>
            </div>
        `;
    }
}

// Новая функция для обновления layout
function updateRecommendationsLayout(rowsCount) {
    const list = document.querySelector('.recommended-exercises-list');
    if (!list) return;
    
    if (rowsCount === 1) {
        list.style.maxHeight = '72px'; // высота для 1 ряда
        list.style.minHeight = '72px';
        list.style.gridTemplateRows = '1fr'; // 1 ряд
    } else {
        list.style.maxHeight = '144px'; // высота для 2 рядов
        list.style.minHeight = '144px';
        list.style.gridTemplateRows = 'repeat(2, 1fr)'; // 2 ряда
    }
}

function getRecommendedExercises(groups) {
    const recommended = [];
    const allExercises = UserExerciseManager.getAllExercises();
    
    Object.entries(allExercises).forEach(([exercise, exerciseGroups]) => {
        if (groups.some(group => exerciseGroups.includes(group))) {
            recommended.push(exercise);
        }
    });
    
    return [...new Set(recommended)]; 
}

function addRecommendedExercise(exerciseName) {
    const exerciseElements = document.querySelectorAll('.exercise');
    let emptyExerciseFound = false;
    
    exerciseElements.forEach(exerciseElement => {
        const nameInput = exerciseElement.querySelector('.exercise-name');
        const setsContainer = exerciseElement.querySelector('.sets-container');
        const sets = setsContainer.querySelectorAll('.set');
        
        if (!nameInput.value.trim() && sets.length === 1) {
            const firstSetInputs = sets[0].querySelectorAll('input[type="number"]');
            const weightInput = firstSetInputs[0];
            const repsInput = firstSetInputs[1];
            
            if (!weightInput.value && repsInput.value === '12') {
                nameInput.value = exerciseName;
                emptyExerciseFound = true;
                return;
            }
        }
    });
    
    if (!emptyExerciseFound) {
        addExercise({ name: exerciseName, sets: [{ weight: '', reps: 12 }] });
    }
}

// АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ ГРУПП МЫШЦ
function autoDetectMuscleGroups(exerciseName) {
    const normalizedName = exerciseName.toLowerCase().trim();
    
    // Сначала проверяем пользовательские упражнения
    const userExercises = UserExerciseManager.getUserExercises();
    if (userExercises[exerciseName]) {
        return userExercises[exerciseName].groups;
    }
    
    // Затем проверяем стандартную базу
    for (const [exercise, groups] of Object.entries(exerciseDatabase)) {
        if (exercise.toLowerCase().includes(normalizedName) || normalizedName.includes(exercise.toLowerCase())) {
            return groups;
        }
    }
    
    return [];
}

function detectMuscleGroupsForAllExercises() {
    const exerciseElements = document.querySelectorAll('.exercise');
    const detectedGroups = new Set();
    
    exerciseElements.forEach(exerciseElement => {
        const exerciseName = exerciseElement.querySelector('.exercise-name').value.trim();
        if (exerciseName) {
            // Ищем в стандартной и пользовательской базе
            const allExercises = UserExerciseManager.getAllExercises();
            const groups = allExercises[exerciseName] || [];
            
            if (groups.length > 0) {
                groups.forEach(group => detectedGroups.add(group));
            }
        }
    });
    
    return Array.from(detectedGroups);
}

function validateTrainingGroups(exercisesData, selectedGroups) {
    const allExerciseGroups = new Set();
    const unknownExercises = [];
    const knownExercises = [];
    
    exercisesData.forEach(exercise => {
        const groups = autoDetectMuscleGroups(exercise.name);
        if (groups.length > 0) {
            groups.forEach(group => allExerciseGroups.add(group));
            knownExercises.push(exercise);
        } else {
            unknownExercises.push(exercise);
        }
    });
    
    const actualGroups = Array.from(allExerciseGroups);
    
    const unmatchedExercises = knownExercises.filter(exercise => {
        const exerciseGroups = autoDetectMuscleGroups(exercise.name);
        return exerciseGroups.length > 0 && !exerciseGroups.some(group => selectedGroups.includes(group));
    });
    
    const unmatchedGroups = selectedGroups.filter(group => !actualGroups.includes(group));
    
    return {
        hasUnknownExercises: unknownExercises.length > 0,
        hasKnownExercisesWithWrongGroups: unmatchedExercises.length > 0 || unmatchedGroups.length > 0,
        unknownExercises: unknownExercises,
        actualGroups: actualGroups,
        selectedGroups: selectedGroups,
        unmatchedExercises: unmatchedExercises,
        unmatchedGroups: unmatchedGroups
    };
}

function showGroupCorrectionModal(validationResult, exercisesData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    let message = '';
    
    if (validationResult.unmatchedExercises.length > 0) {
        message += `
            <p>⚠️ Некоторые упражнения не соответствуют выбранным группам мышц:</p>
            <div style="margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeaa7;">
                ${validationResult.unmatchedExercises.map(ex => `
                    <div style="margin: 5px 0; font-size: 14px;">
                        <strong>${ex.name}</strong> → 
                        ${autoDetectMuscleGroups(ex.name).map(g => muscleGroupMapping[g]).join(', ')}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (validationResult.unmatchedGroups.length > 0) {
        message += `
            <p>❌ Выбраны группы, которые не прорабатываются:</p>
            <div style="margin: 10px 0; padding: 10px; background: #f8d7da; border-radius: 8px; border: 1px solid #f5c6cb;">
                ${validationResult.unmatchedGroups.map(g => `
                    <span style="display: inline-block; background: #dc3545; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin: 2px;">${muscleGroupMapping[g]}</span>
                `).join('')}
            </div>
        `;
    }
    
    message += `
        <p style="margin-top: 15px; font-weight: 600;">✅ Правильные группы для вашей тренировки:</p>
        <div style="margin: 10px 0; padding: 12px; background: #d4edda; border-radius: 8px; border: 1px solid #c3e6cb; text-align: center;">
            ${validationResult.actualGroups.map(g => `
                <span style="display: inline-block; background: #28a745; color: white; padding: 6px 12px; border-radius: 15px; font-size: 13px; margin: 3px; font-weight: 600;">${muscleGroupMapping[g]}</span>
            `).join('')}
        </div>
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>🎯 Корректировка групп мышц</h3>
            </div>
            <div class="modal-body">
                ${message}
                <p style="margin-top: 15px; color: #666; font-size: 14px;">
                    Для точной статистики группы мышц будут исправлены автоматически
                </p>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px;">
                <button id="auto-correct-btn" class="btn-primary" style="flex: 1; margin: 0; padding: 14px; font-size: 16px; font-weight: 600;">
                    ✅ Исправить автоматически
                </button>
                <button id="cancel-save-btn" class="btn-secondary" style="flex: 1; margin: 0; padding: 14px; font-size: 16px; background: #6c757d; color: white;">
                    ❌ Отмена
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('auto-correct-btn').onclick = () => {
        document.body.removeChild(modal);
        setMuscleGroups(validationResult.actualGroups);
        completeTrainingSave(exercisesData, validationResult.actualGroups);
    };
    
    document.getElementById('cancel-save-btn').onclick = () => {
        document.body.removeChild(modal);
        showAlert('💡 Выберите правильные группы мышц или измените упражнения');
    };
}

// ОСНОВНЫЕ ФУНКЦИИ ПРИЛОЖЕНИЯ
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            if (tab.dataset.tab === 'history') loadTrainingHistory();
            else if (tab.dataset.tab === 'stats') { loadStatistics(); updateExerciseSelect(); }
        });
    });
}

function addExercise(exerciseData = null) {
    const container = document.getElementById('exercises-container');
    const exerciseId = 'ex' + Date.now();
    const exerciseName = exerciseData ? exerciseData.name : "";
    
    const placeholder = selectedMuscleGroups.length === 0 
        ? 'Название упражнения (выберите группы мышц для подсказок)'
        : 'Название упражнения';
    
    const exerciseHTML = `
    <div class="exercise" id="exercise-${exerciseId}">
        <div class="exercise-header">
            <input type="text" class="exercise-name" placeholder="${placeholder}" value="${exerciseName}" 
                   oninput="handleExerciseInput(this, '${exerciseId}')"> <!-- ИЗМЕНИЛ ЗДЕСЬ -->
            <button class="remove-exercise" onclick="removeExercise('${exerciseId}')">🗑️</button>
        </div>
        <div class="sets-container" id="sets-${exerciseId}"></div>
        <button class="add-set-btn" onclick="addSet('${exerciseId}')">➕ Добавить подход</button>
    </div>
`;
    container.insertAdjacentHTML('beforeend', exerciseHTML);
    
    if (exerciseData && exerciseData.sets) {
        const setsContainer = document.getElementById(`sets-${exerciseId}`);
        setsContainer.innerHTML = '';
        exerciseData.sets.forEach((set, index) => {
            const setHTML = `
                <div class="set">
                    <div class="set-number">${index + 1}</div>
                    <input type="number" placeholder="Вес (кг)" value="${set.weight || ''}" min="0">
                    <input type="number" placeholder="Повторения" value="${set.reps || ''}" min="0">
                    <button class="remove-set" onclick="removeSet(this, '${exerciseId}')">❌</button>
                </div>
            `;
            setsContainer.insertAdjacentHTML('beforeend', setHTML);
        });
    } else {
        addSet(exerciseId);
    }
    
    // Обновляем плейсхолдеры после добавления упражнения
    updateExercisePlaceholders();
}

function handleExerciseInput(input, exerciseId) {
    const exerciseName = input.value.trim();
    
    clearTimeout(suggestionsTimeout);
    
    // ЕСЛИ ПОЛЕ ПУСТОЕ - СКРЫВАЕМ АВТОДОПОЛНЕНИЕ И НЕ ЗАПУСКАЕМ ТАЙМЕР
    if (!exerciseName) {
        hideSuggestions();
        return; // ВАЖНО: выходим из функции, не запуская таймер
    }
    
    // ТОЛЬКО если есть текст - запускаем таймер для показа suggestions
    suggestionsTimeout = setTimeout(() => {
        showExerciseSuggestions(input);
    }, 300);
}

function removeExercise(exerciseId) {
    const exerciseElement = document.getElementById(`exercise-${exerciseId}`);
    if (exerciseElement) exerciseElement.remove();
}

// ДОБАВЛЕНИЕ КАРДИО
function addCardio(cardioData = null) {
    const container = document.getElementById('cardio-container');
    const cardioId = 'cardio' + Date.now();
    
    const cardioHTML = `
    <div class="cardio-exercise" id="cardio-${cardioId}">
        <div class="cardio-header">
            <input type="text" class="cardio-name" placeholder="Название кардио" 
                   value="${cardioData ? cardioData.name : ''}"
                   oninput="showCardioSuggestions(this, '${cardioId}')"
                   onfocus="showCardioSuggestions(this, '${cardioId}')">
            <button class="remove-cardio" onclick="removeCardio('${cardioId}')">🗑️</button>
        </div>
        <div class="cardio-suggestions" id="suggestions-${cardioId}"></div>
        <div class="cardio-fields">
    <div class="cardio-field-group">
        <input type="number" class="cardio-time" 
               placeholder="Время (мин)" 
               min="1">
    </div>
    <div class="cardio-field-group">
        <input type="number" class="cardio-intensity" 
               placeholder="Интенсивность" 
               min="1" max="30">
    </div>
    <div class="cardio-field-group">
        <input type="number" class="cardio-calories" 
               placeholder="Калории" 
               min="0">
    </div>
</div>

        </div>
    </div>
`;
    container.insertAdjacentHTML('beforeend', cardioHTML);
    
    // Обновляем лейблы после добавления
    setTimeout(() => {
        updateCardioLabels();
    }, 100);
}

function handleCardioInputFocus(input) {
    const fieldGroup = input.closest('.cardio-field-group');
    fieldGroup.style.setProperty('--label-opacity', '0');
    
    // Добавляем класс для стилизации фокуса
    fieldGroup.classList.add('focused');
    
    // Для iOS - принудительно центрируем текст
    setTimeout(() => {
        input.style.textAlign = 'center';
    }, 10);
}

function handleCardioInputBlur(input) {
    const fieldGroup = input.closest('.cardio-field-group');
    
    if (!input.value || input.value === '') {
        fieldGroup.style.setProperty('--label-opacity', '1');
    }
    
    fieldGroup.classList.remove('focused');
}

// Обновленная функция для обновления лейблов
function updateCardioLabels() {
    document.querySelectorAll('.cardio-field-group input').forEach(input => {
        const fieldGroup = input.closest('.cardio-field-group');
        if (input.value && input.value !== '') {
            fieldGroup.style.setProperty('--label-opacity', '0');
        } else {
            fieldGroup.style.setProperty('--label-opacity', '1');
        }
        
        // Принудительно центрируем текст для мобильных
        input.style.textAlign = 'center';
    });
}

// УДАЛЕНИЕ КАРДИО
function removeCardio(cardioId) {
    if (confirm('Удалить это кардио упражнение?')) {
        const cardioElement = document.getElementById(`cardio-${cardioId}`);
        if (cardioElement) cardioElement.remove();
    }
}

// ПОКАЗАТЬ ПРЕДЛОЖЕНИЯ ДЛЯ КАРДИО
function showCardioSuggestions(inputElement, cardioId) {
    const query = inputElement.value.trim();
    const suggestionsContainer = document.getElementById(`suggestions-${cardioId}`);
    
    if (!query) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    const allExercises = UserCardioManager.getAllCardioExercises();
    const similarExercises = UserCardioManager.findSimilarExercises(query);
    
    let suggestionsHTML = '';
    
    if (similarExercises.length > 0) {
        similarExercises.slice(0, 5).forEach(exercise => {
            const exerciseInfo = allExercises[exercise];
            suggestionsHTML += `
                <div class="suggestion-item" onclick="selectCardioSuggestion('${exercise}', '${cardioId}')">
                    <span class="exercise-icon">${exerciseInfo.icon}</span>
                    <span class="exercise-name-suggestion">${exercise}</span>
                    ${exerciseInfo.type === 'пользователь' ? '<span style="margin-left: 8px; background: #00d4aa; color: black; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600;">ВАШЕ</span>' : ''}
                </div>
            `;
        });
        
        // Добавляем кнопку для создания нового кардио
        suggestionsHTML += `
            <div class="suggestion-item new-exercise-item" onclick="addNewCardioExercise('${cardioId}')" style="border-top: 1px solid #404040; background: #1a1a1a;">
                <span class="exercise-icon">➕</span>
                <span class="exercise-name-suggestion">Создать "${query}"</span>
                <span style="margin-left: 8px; background: #6366f1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600;">НОВОЕ</span>
            </div>
        `;
    } else {
        // Если нет похожих упражнений, предлагаем создать новое
        suggestionsHTML = `
            <div class="suggestion-item new-exercise-item" onclick="addNewCardioExercise('${cardioId}')" style="background: #1a1a1a;">
                <span class="exercise-icon">➕</span>
                <span class="exercise-name-suggestion">Создать "${query}"</span>
                <span style="margin-left: 8px; background: #6366f1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 600;">НОВОЕ КАРДИО</span>
            </div>
        `;
    }
    
    if (suggestionsHTML) {
        suggestionsContainer.innerHTML = suggestionsHTML;
        
        const cardioExercise = inputElement.closest('.cardio-exercise');
        cardioExercise.style.position = 'relative';
        
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.bottom = '100%';
        suggestionsContainer.style.left = '0';
        suggestionsContainer.style.right = '0';
        suggestionsContainer.style.marginBottom = '5px';
        suggestionsContainer.style.width = '100%';
        
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

// ВЫБРАТЬ ПРЕДЛОЖЕНИЕ
function selectCardioSuggestion(exerciseName, cardioId) {
    const inputElement = document.querySelector(`#cardio-${cardioId} .cardio-name`);
    const suggestionsContainer = document.getElementById(`suggestions-${cardioId}`);
    
    inputElement.value = exerciseName;
    suggestionsContainer.style.display = 'none';
    
    // Автоматически добавляем группу "кардио" если еще не добавлена
    if (!selectedMuscleGroups.includes('cardio')) {
        const cardioCheckbox = document.querySelector('#muscle-groups-dropdown input[value="cardio"]');
        if (cardioCheckbox) {
            cardioCheckbox.checked = true;
            updateSelectedGroups();
        }
    }
}

// ДОБАВИТЬ НОВОЕ КАРДИО УПРАЖНЕНИЕ
function addNewCardioExercise(cardioId) {
    const inputElement = document.querySelector(`#cardio-${cardioId} .cardio-name`);
    const exerciseName = inputElement.value.trim();
    
    if (exerciseName) {
        // Сохраняем в пользовательские упражнения
        UserCardioManager.addUserCardioExercise(exerciseName);
        
        // Закрываем suggestions
        const suggestionsContainer = document.getElementById(`suggestions-${cardioId}`);
        suggestionsContainer.style.display = 'none';
        
        // Автоматически добавляем группу "кардио"
        if (!selectedMuscleGroups.includes('cardio')) {
            const cardioCheckbox = document.querySelector('#muscle-groups-dropdown input[value="cardio"]');
            if (cardioCheckbox) {
                cardioCheckbox.checked = true;
                updateSelectedGroups();
            }
        }
        
        showAlert(`✅ Кардио "${exerciseName}" добавлено в вашу базу!`);
    }
}

// СКРЫТЬ ПРЕДЛОЖЕНИЯ ПРИ КЛИКЕ ВНЕ
document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('cardio-name')) {
        document.querySelectorAll('.cardio-suggestions').forEach(container => {
            container.style.display = 'none';
        });
    }
});

function addSet(exerciseId) {
    const container = document.getElementById(`sets-${exerciseId}`);
    const sets = container.querySelectorAll('.set');
    const setNumber = sets.length + 1;
    let defaultWeight = '';
    if (setNumber > 1) {
        const previousSet = sets[setNumber - 2];
        const previousWeightInput = previousSet.querySelector('input[type="number"]');
        const previousWeight = parseInt(previousWeightInput.value) || 0;
        if (previousWeight > 0) defaultWeight = previousWeight + 5;
    }
    const defaultReps = 12;
    const setHTML = `
        <div class="set">
            <div class="set-number">${setNumber}</div>
            <input type="number" placeholder="Вес (кг)" value="${defaultWeight}" min="0">
            <input type="number" placeholder="Повторения" value="${defaultReps}" min="0">
            <button class="remove-set" onclick="removeSet(this, '${exerciseId}')">❌</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', setHTML);
}

function removeSet(button, exerciseId) {
    button.parentElement.remove();
    updateSetNumbers(exerciseId);
}

function updateSetNumbers(exerciseId) {
    const container = document.getElementById(`sets-${exerciseId}`);
    const sets = container.querySelectorAll('.set');
    sets.forEach((set, index) => set.querySelector('.set-number').textContent = index + 1);
}

function loadLastTraining() {
    console.log("🔄 Загружаем последнюю тренировку...");
    
    const selectedGroups = selectedMuscleGroups;
    const messageElement = document.getElementById('auto-fill-message');
    
    messageElement.textContent = '';
    messageElement.className = 'auto-fill-message';

    if (selectedGroups.length === 0) {
        messageElement.textContent = '❌ Сначала выберите группы мышц';
        messageElement.className = 'auto-fill-message auto-fill-info';
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'auto-fill-message';
        }, 3000);
        return;
    }

    const saved = DataManager.getTrainings();
    console.log("📊 Всего тренировок:", saved.length);
    
    if (saved.length === 0) {
        messageElement.textContent = 'ℹ️ Нет сохраненных тренировок';
        messageElement.className = 'auto-fill-message auto-fill-info';
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'auto-fill-message';
        }, 3000);
        document.getElementById('exercises-container').innerHTML = '';
        addExercise();
        return;
    }

    const matchingTrainings = saved.filter(training => {
        const trainingGroups = Array.isArray(training.type) ? training.type : [training.type];
        return selectedGroups.every(group => trainingGroups.includes(group));
    });

    console.log("🎯 Подходящие тренировки:", matchingTrainings.length);

    if (matchingTrainings.length === 0) {
        const partialMatchingTrainings = saved.filter(training => {
            const trainingGroups = Array.isArray(training.type) ? training.type : [training.type];
            return selectedGroups.some(group => trainingGroups.includes(group));
        });

        console.log("🎯 Частично подходящие тренировки:", partialMatchingTrainings.length);

        if (partialMatchingTrainings.length === 0) {
            messageElement.textContent = '❌ Не найдено тренировок для выбранных групп мышц';
            messageElement.className = 'auto-fill-message auto-fill-info';
            setTimeout(() => {
                messageElement.textContent = '';
                messageElement.className = 'auto-fill-message';
            }, 3000);
            return;
        }

        const lastPartialTraining = partialMatchingTrainings.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        )[0];

        console.log("📅 Загружаем частично подходящую тренировку:", lastPartialTraining);
        loadTrainingIntoForm(lastPartialTraining);
        
        const cardioInfo = lastPartialTraining.cardio && lastPartialTraining.cardio.length > 0 
            ? ` + ${lastPartialTraining.cardio.length} кардио` 
            : '';
            
        messageElement.textContent = `✅ Загружена тренировка на ${selectedGroups.map(g => muscleGroupMapping[g]).join(' + ')}${cardioInfo} от ${new Date(lastPartialTraining.date).toLocaleDateString('ru-RU')}`;
        messageElement.className = 'auto-fill-message auto-fill-info';
        
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.className = 'auto-fill-message';
        }, 3000);
        return;
    }

    const lastMatchingTraining = matchingTrainings.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    )[0];

    console.log("📅 Загружаем подходящую тренировку:", lastMatchingTraining);
    loadTrainingIntoForm(lastMatchingTraining);
    
    const cardioInfo = lastMatchingTraining.cardio && lastMatchingTraining.cardio.length > 0 
        ? ` + ${lastMatchingTraining.cardio.length} кардио` 
        : '';
        
    messageElement.textContent = `✅ Загружена тренировка на ${selectedGroups.map(g => muscleGroupMapping[g]).join(' + ')}${cardioInfo} от ${new Date(lastMatchingTraining.date).toLocaleDateString('ru-RU')}`;
    messageElement.className = 'auto-fill-message auto-fill-success';
    
    setTimeout(() => {
        messageElement.textContent = '';
        messageElement.className = 'auto-fill-message';
    }, 3000);
}

function loadTrainingIntoForm(training) {
    console.log("🔄 Загружаем тренировку в форму:", training);
    
    const container = document.getElementById('exercises-container');
    const cardioContainer = document.getElementById('cardio-container');
    
    // Очищаем контейнеры
    container.innerHTML = '';
    cardioContainer.innerHTML = '';
    
    // Устанавливаем дату
    document.getElementById('training-date').value = training.date;
    
    // Устанавливаем группы мышц
    const trainingGroups = Array.isArray(training.type) ? training.type : [training.type];
    setMuscleGroups(trainingGroups);
    
    // Загружаем силовые упражнения
    if (training.exercises && training.exercises.length > 0) {
        training.exercises.forEach((exercise, index) => {
            setTimeout(() => {
                console.log("➕ Добавляем упражнение:", exercise.name);
                addExercise({ 
                    name: exercise.name, 
                    sets: exercise.sets || [] 
                });
            }, index * 100);
        });
    } else {
        // Добавляем пустое упражнение если нет упражнений
        setTimeout(() => addExercise(), 100);
    }
    
    // ЗАГРУЖАЕМ КАРДИО УПРАЖНЕНИЯ
    if (training.cardio && training.cardio.length > 0) {
        console.log("🏃 Добавляем кардио:", training.cardio);
        training.cardio.forEach((cardio, index) => {
            setTimeout(() => {
                console.log("➕ Добавляем кардио:", cardio.name);
                addCardio({
                    name: cardio.name,
                    time: cardio.time || '',
                    intensity: cardio.intensity || '',
                    calories: cardio.calories || ''
                });
            }, index * 100);
        });
    }
    
    console.log("✅ Загрузка тренировки завершена");
}

function saveTraining() {
    // СОБИРАЕМ СИЛОВЫЕ УПРАЖНЕНИЯ
    const exerciseElements = document.querySelectorAll('.exercise');
    let hasValidExercises = false;
    const exercisesData = [];
    const unknownExercises = [];
    
    exerciseElements.forEach(exerciseElement => {
        const exerciseName = exerciseElement.querySelector('.exercise-name').value.trim();
        const sets = [];
        exerciseElement.querySelectorAll('.set').forEach(setElement => {
            const inputs = setElement.querySelectorAll('input[type="number"]');
            const weight = parseInt(inputs[0].value) || 0;
            const reps = parseInt(inputs[1].value) || 0;
            if (weight > 0 && reps > 0) sets.push({ weight, reps });
        });
        
        if (exerciseName && sets.length > 0) {
            exercisesData.push({ name: exerciseName, sets: sets });
            hasValidExercises = true;
            
            // Проверяем, известно ли упражнение (стандартное + пользовательское)
            const allExercises = UserExerciseManager.getAllExercises();
            if (!allExercises[exerciseName]) {
                unknownExercises.push({ name: exerciseName, sets: sets });
            }
        }
    });
    
    // СОБИРАЕМ КАРДИО УПРАЖНЕНИЯ
    const cardioElements = document.querySelectorAll('.cardio-exercise');
    const cardioData = [];
    let hasValidCardio = false;
    
    cardioElements.forEach(cardioElement => {
        const cardioName = cardioElement.querySelector('.cardio-name').value.trim();
        const time = parseInt(cardioElement.querySelector('.cardio-time').value) || 0;
        const intensity = parseInt(cardioElement.querySelector('.cardio-intensity').value) || 0;
        const calories = parseInt(cardioElement.querySelector('.cardio-calories').value) || 0;
        
        if (cardioName && time > 0) {
            cardioData.push({ name: cardioName, time, intensity, calories });
            hasValidCardio = true;
        }
    });
    
    // ПРОВЕРКА ЧТО ЕСТЬ ХОТЯ БЫ ОДИН ТИП УПРАЖНЕНИЙ
    if (!hasValidExercises && !hasValidCardio) {
        showAlert('❌ Добавьте хотя бы одно силовое упражнение с подходами ИЛИ кардио упражнение с временем');
        return;
    }
    
    // ЕСЛИ ЕСТЬ НЕИЗВЕСТНЫЕ УПРАЖНЕНИЯ - ПОКАЗЫВАЕМ МОДАЛКУ
    if (unknownExercises.length > 0) {
        currentExercisesDataForModal = { 
            exercises: exercisesData, 
            cardio: cardioData
        };
        showNewExercisesModal(unknownExercises);
        return;
    }
    
    // ЕСЛИ ВСЕ УПРАЖНЕНИЯ ИЗВЕСТНЫ - СОХРАНЯЕМ АВТОМАТИЧЕСКИ
    const detectedGroups = detectMuscleGroupsForAllExercises();
    let finalGroups = [...detectedGroups];
    
    // ЕСЛИ ЕСТЬ КАРДИО - ДОБАВЛЯЕМ ГРУППУ КАРДИО
    if (hasValidCardio && !finalGroups.includes('cardio')) {
        finalGroups.push('cardio');
    }
    
    // ЕСЛИ ВСЕ ЕЩЕ НЕТ ГРУПП - ИСПОЛЬЗУЕМ ПО УМОЛЧАНИЮ
    if (finalGroups.length === 0) {
        if (hasValidCardio) {
            finalGroups = ['cardio'];
        } else {
            finalGroups = ['other'];
        }
    }
    
    // СОХРАНЯЕМ ТРЕНИРОВКУ
    completeTrainingSave(exercisesData, finalGroups, cardioData);
}

function getUnknownExercises(exercisesData) {
    return exercisesData.filter(exercise => {
        const allExercises = UserExerciseManager.getAllExercises();
        return !allExercises[exercise.name];
    });
}

function completeTrainingSave(exercisesData, groups, cardioData = []) {
    const trainingData = {
        date: document.getElementById('training-date').value,
        type: groups,
        exercises: exercisesData,
        cardio: cardioData
    };
    
    const success = DataManager.addTraining(trainingData);
    if (success) {
        showAlert('✅ Тренировка сохранена!');
        
        // ОЧИСТКА ФОРМЫ
        document.getElementById('exercises-container').innerHTML = '';
        document.getElementById('cardio-container').innerHTML = '';
        selectedMuscleGroups = [];
        updateSelectedGroups();
        updateExercisePlaceholders();
        addExercise();
        
        document.getElementById('auto-fill-message').textContent = '';
        StatsCache.personalRecords = null;
        StatsCache.muscleLoad = null;
        StatsCache.exerciseEffectiveness = null;
        showSmartRecommendations();
        
        // ОБНОВЛЯЕМ ИСТОРИЮ ЕСЛИ АКТИВНА ВКЛАДКА
        if (document.getElementById('history').classList.contains('active')) {
            loadTrainingHistory();
        }
        
    } else {
        showAlert('❌ Ошибка при сохранении тренировки');
    }
}

// ФУНКЦИИ ДЛЯ ЗАГРУЗКИ ТРЕНИРОВОК
function setMuscleGroups(groups) {
    console.log("🎯 Устанавливаем группы мышц:", groups);
    
    // Сначала снимаем все выделения
    const checkboxes = document.querySelectorAll('#muscle-groups-dropdown input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Затем устанавливаем выбранные группы
    groups.forEach(group => {
        const checkbox = document.querySelector(`#muscle-groups-dropdown input[value="${group}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });
    
    // Обновляем отображение выбранных групп
    updateSelectedGroups();
}

function loadTrainingIntoForm(training) {
    console.log("🔄 Загружаем тренировку в форму:", training);
    
    const container = document.getElementById('exercises-container');
    const cardioContainer = document.getElementById('cardio-container');
    
    // Очищаем контейнеры
    container.innerHTML = '';
    cardioContainer.innerHTML = '';
    
    // Устанавливаем дату
    document.getElementById('training-date').value = training.date;
    
    // Устанавливаем группы мышц
    const trainingGroups = Array.isArray(training.type) ? training.type : [training.type];
    setMuscleGroups(trainingGroups);
    
    // Загружаем силовые упражнения
    if (training.exercises && training.exercises.length > 0) {
        training.exercises.forEach((exercise, index) => {
            setTimeout(() => {
                console.log("➕ Добавляем упражнение:", exercise.name);
                addExercise({ 
                    name: exercise.name, 
                    sets: exercise.sets || [] 
                });
            }, index * 100);
        });
    } else {
        // Добавляем пустое упражнение если нет упражнений
        setTimeout(() => addExercise(), 100);
    }
    
    // ЗАГРУЖАЕМ КАРДИО УПРАЖНЕНИЯ
    if (training.cardio && training.cardio.length > 0) {
        console.log("🏃 Добавляем кардио:", training.cardio);
        training.cardio.forEach((cardio, index) => {
            setTimeout(() => {
                console.log("➕ Добавляем кардио:", cardio.name);
                addCardio({
                    name: cardio.name,
                    time: cardio.time || '',
                    intensity: cardio.intensity || '',
                    calories: cardio.calories || ''
                });
            }, index * 100);
        });
    }
    
    console.log("✅ Загрузка тренировки завершена");
}

// ИСТОРИЯ ТРЕНИРОВОК
function loadTrainingHistory() {
    const saved = DataManager.getTrainings();
    const container = document.getElementById('trainings-list');
    container.innerHTML = '';
    
    if (saved.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>Пока нет сохраненных тренировок</p></div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    saved.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(training => {
        const trainingType = Array.isArray(training.type) ? 
            training.type.map(t => getMuscleGroupName(t)).join(' + ') : 
            getMuscleGroupName(training.type);
            
        const trainingHTML = `
            <div class="training-item">
                <div class="training-header">
                    <div class="training-date">${new Date(training.date).toLocaleDateString('ru-RU')}</div>
                    <div class="training-type">${trainingType}</div>
                    <div class="training-actions">
                        <div class="training-menu">
                            <button class="menu-trigger" onclick="toggleTrainingMenu('menu-${training.id}')">⚙️</button>
                            <div class="training-dropdown" id="menu-${training.id}">
                                <button class="dropdown-item" onclick="showEditAllSetsModal('${training.id}')">
                                    <span class="icon">✏️</span>Редактировать тренировку
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item" onclick="removeTraining('${training.id}')" style="color: #ff3b30;">
                                    <span class="icon">🗑️</span>Удалить тренировку
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="training-exercises">
    ${training.exercises.map((exercise, exerciseIndex) => `
        <div class="exercise-detail">
            <div class="exercise-header-row">
                <div class="exercise-name-display" id="display-${training.id}-${exerciseIndex}">${exercise.name}</div>
                <input type="text" class="exercise-name-edit" id="edit-${training.id}-${exerciseIndex}" 
                       value="${exercise.name}" style="display: none;"
                       onkeypress="handleExerciseNameEdit(event, '${training.id}', ${exerciseIndex})">
                <div class="exercise-actions">
                    <button class="edit-exercise-btn" id="edit-btn-${training.id}-${exerciseIndex}" 
                            onclick="startEditExerciseName('${training.id}', ${exerciseIndex})">✏️</button>
                    <button class="confirm-edit-btn" id="confirm-btn-${training.id}-${exerciseIndex}" 
                            onclick="confirmEditExerciseName('${training.id}', ${exerciseIndex})" style="display: none;">✓</button>
                    <button class="delete-exercise-btn" 
                            onclick="removeExerciseFromTraining('${training.id}', ${exerciseIndex})">🗑️</button>
                </div>
            </div>
            <div class="exercise-sets">
                ${exercise.sets.map((set, setIndex) => `
                    <div class="set-detail">${setIndex + 1}: ${set.weight}кг × ${set.reps}</div>
                `).join('')}
            </div>
        </div>
    `).join('')}
    
    <!-- КАРДИО БЛОК -->
    ${training.cardio && training.cardio.length > 0 ? `
        <div class="cardio-history-section">
            <div class="cardio-history-header">Кардио нагрузка</div>
            ${training.cardio.map((cardio, cardioIndex) => `
                <div class="cardio-history-item">
                    <div class="cardio-history-main">
                        <span class="cardio-history-name">${cardio.name}</span>
                        <span class="cardio-history-time">${cardio.time} мин</span>
                    </div>
                    <div class="cardio-history-details">
                        ${cardio.intensity ? `<span class="cardio-detail">💪 ${cardio.intensity}/30</span>` : ''}
                        ${cardio.calories ? `<span class="cardio-detail">🔥 ${cardio.calories} ккал</span>` : ''}
                    </div>
                    <div class="cardio-history-actions">
                        <button class="edit-cardio-btn" onclick="editCardioInHistory('${training.id}', ${cardioIndex})">✏️</button>
                        <button class="delete-cardio-btn" onclick="deleteCardioFromHistory('${training.id}', ${cardioIndex})">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : ''}
</div>
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = trainingHTML;
        fragment.appendChild(tempDiv.firstElementChild);
    });
    
    container.appendChild(fragment);
}

function removeExerciseFromTraining(trainingId, exerciseIndex) {
    if (!confirm('Удалить это упражнение из тренировки?')) return;
    
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    
    if (training && training.exercises[exerciseIndex]) {
        training.exercises.splice(exerciseIndex, 1);
        
        let success = false;
        
        if (training.exercises.length === 0) {
            const updatedTrainings = saved.filter(t => t.id.toString() !== trainingId.toString());
            success = DataManager.saveTrainings(updatedTrainings);
            if (success) {
                alert('✅ Тренировка удалена (не осталось упражнений)!');
                // ПЕРЕЗАГРУЖАЕМ ИСТОРИЮ
                loadTrainingHistory();
            }
        } else {
            success = DataManager.saveTrainings(saved);
            if (success) {
                alert('✅ Упражнение удалено из тренировки!');
                // ПЕРЕЗАГРУЖАЕМ ИСТОРИЮ
                loadTrainingHistory();
            }
        }
        
        if (!success) {
            alert('❌ Ошибка при сохранении изменений');
        }
    }
}

function confirmEditExerciseName(trainingId, exerciseIndex) {
    const displayElement = document.getElementById(`display-${trainingId}-${exerciseIndex}`);
    const editElement = document.getElementById(`edit-${trainingId}-${exerciseIndex}`);
    const editBtn = document.getElementById(`edit-btn-${trainingId}-${exerciseIndex}`);
    const confirmBtn = document.getElementById(`confirm-btn-${trainingId}-${exerciseIndex}`);
    const newName = editElement.value.trim();
    
    if (newName) {
        updateExerciseName(trainingId, exerciseIndex, newName);
        displayElement.textContent = newName;
        displayElement.style.display = 'block';
        editElement.style.display = 'none';
        editBtn.style.display = 'block';
        confirmBtn.style.display = 'none';
        
        alert('✅ Название упражнения обновлено!');
    } else {
        alert('❌ Название упражнения не может быть пустым');
        editElement.focus();
    }
}

function startEditExerciseName(trainingId, exerciseIndex) {
    const displayElement = document.getElementById(`display-${trainingId}-${exerciseIndex}`);
    const editElement = document.getElementById(`edit-${trainingId}-${exerciseIndex}`);
    const editBtn = document.getElementById(`edit-btn-${trainingId}-${exerciseIndex}`);
    const confirmBtn = document.getElementById(`confirm-btn-${trainingId}-${exerciseIndex}`);
    displayElement.style.display = 'none';
    editElement.style.display = 'block';
    editBtn.style.display = 'none';
    confirmBtn.style.display = 'block';
    editElement.focus();
    editElement.select();
}

function handleExerciseNameEdit(event, trainingId, exerciseIndex) {
    if (event.key === 'Enter') confirmEditExerciseName(trainingId, exerciseIndex);
}

function updateExerciseName(trainingId, exerciseIndex, newName) {
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    if (training && training.exercises[exerciseIndex]) {
        training.exercises[exerciseIndex].name = newName.trim();
        DataManager.saveTrainings(saved);
        StatsCache.personalRecords = null;
        StatsCache.exerciseEffectiveness = null;
        if (document.querySelector('#stats').classList.contains('active')) { 
            loadStatistics(); 
            updateExerciseSelect(); 
        }
    }
}

// РЕДАКТИРОВАНИЕ КАРДИО В ИСТОРИИ
function editCardioInHistory(trainingId, cardioIndex) {
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    
    if (training && training.cardio && training.cardio[cardioIndex]) {
        const cardio = training.cardio[cardioIndex];
        
        // Создаем модальное окно для редактирования
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Редактировать кардио</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Название кардио</label>
                        <input type="text" id="edit-cardio-name" value="${cardio.name}" class="input">
                    </div>
                    <div class="form-group">
                        <label>⏱️ Время (минуты)*</label>
                        <input type="number" id="edit-cardio-time" value="${cardio.time}" class="input" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>💪 Интенсивность (1-30)</label>
                        <input type="number" id="edit-cardio-intensity" value="${cardio.intensity || ''}" class="input" min="1" max="30">
                    </div>
                    <div class="form-group">
                        <label>🔥 Калории</label>
                        <input type="number" id="edit-cardio-calories" value="${cardio.calories || ''}" class="input" min="0">
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveCardioEdit('${trainingId}', ${cardioIndex})" class="btn-primary">💾 Сохранить</button>
                    <button onclick="this.closest('.modal').remove()" class="btn-secondary">❌ Отмена</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}

// СОХРАНИТЬ РЕДАКТИРОВАНИЕ КАРДИО
function saveCardioEdit(trainingId, cardioIndex) {
    const name = document.getElementById('edit-cardio-name').value.trim();
    const time = parseInt(document.getElementById('edit-cardio-time').value) || 0;
    const intensity = parseInt(document.getElementById('edit-cardio-intensity').value) || 0;
    const calories = parseInt(document.getElementById('edit-cardio-calories').value) || 0;
    
    if (!name || time <= 0) {
        showAlert('❌ Заполните название и время кардио');
        return;
    }
    
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    
    if (training && training.cardio && training.cardio[cardioIndex]) {
        training.cardio[cardioIndex] = { name, time, intensity, calories };
        
        if (DataManager.saveTrainings(saved)) {
            document.querySelector('.modal').remove();
            loadTrainingHistory();
            showAlert('✅ Кардио обновлено!');
        }
    }
}

// УДАЛИТЬ КАРДИО ИЗ ИСТОРИИ
function deleteCardioFromHistory(trainingId, cardioIndex) {
    if (!confirm('Удалить это кардио из тренировки?')) return;
    
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    
    if (training && training.cardio && training.cardio[cardioIndex]) {
        training.cardio.splice(cardioIndex, 1);
        
        if (DataManager.saveTrainings(saved)) {
            loadTrainingHistory();
            showAlert('✅ Кардио удалено из тренировки!');
        }
    }
}

function toggleTrainingMenu(menuId) {
    // Сначала закрываем все открытые меню
    closeAllMenus();
    
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.toggle('show');
        
        // Добавляем обработчик клика вне меню
        if (menu.classList.contains('show')) {
            setTimeout(() => {
                document.addEventListener('click', closeMenuOnClickOutside);
            }, 0);
        }
    }
}

// Новая функция для закрытия при клике вне меню
function closeMenuOnClickOutside(event) {
    const menus = document.querySelectorAll('.training-dropdown.show');
    let clickedInsideMenu = false;
    
    menus.forEach(menu => {
        if (menu.contains(event.target) || 
            event.target.closest('.menu-trigger') || 
            event.target.classList.contains('menu-trigger')) {
            clickedInsideMenu = true;
        }
    });
    
    if (!clickedInsideMenu) {
        closeAllMenus();
        document.removeEventListener('click', closeMenuOnClickOutside);
    }
}

function closeAllMenus() {
    // Закрываем все dropdown меню
    document.querySelectorAll('.training-dropdown').forEach(menu => {
        menu.classList.remove('show');
    });
    
    // Удаляем backdrop
    document.querySelectorAll('.dropdown-backdrop').forEach(backdrop => {
        backdrop.remove();
    });
    
    // Удаляем обработчик клика вне меню
    document.removeEventListener('click', closeMenuOnClickOutside);
}

function showEditAllSetsModal(trainingId) {
    closeAllMenus();
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    if (!training) return;
    
    currentEditingTrainingId = trainingId;
    const modal = document.getElementById('edit-sets-modal');
    const container = document.getElementById('sets-edit-container');
    
    container.innerHTML = '';
    
    // Ограничиваем количество одновременно отображаемых упражнений
    training.exercises.forEach((exercise, exerciseIndex) => {
        const exerciseHTML = `
            <div class="exercise-edit-section">
                <div class="exercise-header-row">
                    <input type="text" class="exercise-name-edit" value="${exercise.name}" 
                           onchange="updateExerciseNameInModal('${trainingId}', ${exerciseIndex}, this.value)"
                           placeholder="Название упражнения">
                    <button class="delete-exercise-btn" onclick="removeExerciseFromTrainingInModal('${trainingId}', ${exerciseIndex})">
                        🗑️ Удалить
                    </button>
                </div>
                <div class="sets-edit-list">
                    ${exercise.sets.map((set, setIndex) => `
                        <div class="set-edit-row">
                            <div class="set-edit-number">${setIndex + 1}</div>
                            <input type="number" class="set-edit-input" value="${set.weight}" 
                                   onchange="updateSetInEditMode('${trainingId}', ${exerciseIndex}, ${setIndex}, 'weight', this.value)"
                                   placeholder="Вес" min="0">
                            <span style="font-weight: bold; color: white;">×</span>
                            <input type="number" class="set-edit-input" value="${set.reps}" 
                                   onchange="updateSetInEditMode('${trainingId}', ${exerciseIndex}, ${setIndex}, 'reps', this.value)"
                                   placeholder="Повт." min="0">
                            <button class="remove-set-btn" onclick="removeSetInEditMode('${trainingId}', ${exerciseIndex}, ${setIndex})">❌</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-secondary" onclick="addSetToExerciseInTraining('${trainingId}', ${exerciseIndex})" 
                        style="width: 100%; margin-top: 6px; padding: 8px; font-size: 13px;">
                    ➕ Добавить подход
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', exerciseHTML);
    });
    
    modal.style.display = 'flex';
    
    // ФИКС ДЛЯ IOS: Прокручиваем в начало
    setTimeout(() => {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
    }, 50);
}

function updateExerciseNameInModal(trainingId, exerciseIndex, newName) {
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    if (training && training.exercises[exerciseIndex]) {
        training.exercises[exerciseIndex].name = newName.trim();
        const success = DataManager.saveTrainings(saved);
        if (success) {
            alert('✅ Название упражнения обновлено!');
        }
    }
}

function removeExerciseFromTrainingInModal(trainingId, exerciseIndex) {
    if (!confirm('Удалить это упражнение из тренировки?')) return;
    
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    
    if (training && training.exercises[exerciseIndex]) {
        training.exercises.splice(exerciseIndex, 1);
        const success = DataManager.saveTrainings(saved);
        
        if (success) {
            // НЕ перезагружаем историю, просто обновляем модалку
            showEditAllSetsModal(trainingId);
        } else {
            alert('❌ Ошибка при сохранении изменений');
        }
    }
}

function addNewExerciseToTrainingInModal() {
    if (currentEditingTrainingId) {
        const saved = DataManager.getTrainings();
        const training = saved.find(t => t.id.toString() === currentEditingTrainingId.toString());
        if (training) {
            training.exercises.push({ 
                name: 'Новое упражнение', 
                sets: [{ weight: 0, reps: 12 }] 
            });
            const success = DataManager.saveTrainings(saved);
            if (success) {
                showEditAllSetsModal(currentEditingTrainingId);
            }
        }
    }
}

function closeEditSetsModal() {
    const modal = document.getElementById('edit-sets-modal');
    modal.style.display = 'none';
    currentEditingTrainingId = null;
}

function saveEditedSets() {
    closeEditSetsModal();
    // ПЕРЕЗАГРУЖАЕМ ИСТОРИЮ ТОЛЬКО ЗДЕСЬ
    loadTrainingHistory();
    setTimeout(() => {
        alert('✅ Изменения внесены в тренировку!');
    }, 300);
}

function removeSetInEditMode(trainingId, exerciseIndex, setIndex) {
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    if (training && training.exercises[exerciseIndex]) {
        const exercise = training.exercises[exerciseIndex];
        if (exercise.sets.length > 1) {
            exercise.sets.splice(setIndex, 1);
            DataManager.saveTrainings(saved);
            showEditAllSetsModal(trainingId);
        } else {
            showAlert('❌ Нельзя удалить последний подход');
        }
    }
}

function addSetToExerciseInTraining(trainingId, exerciseIndex) {
    const saved = DataManager.getTrainings();
    const training = saved.find(t => t.id.toString() === trainingId.toString());
    if (training && training.exercises[exerciseIndex]) {
        const exercise = training.exercises[exerciseIndex];
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSet = lastSet ? { ...lastSet } : { weight: 0, reps: 12 };
        exercise.sets.push(newSet);
        DataManager.saveTrainings(saved);
        showEditAllSetsModal(trainingId);
    }
}

function removeTraining(trainingId) {
    closeAllMenus();
    if (!confirm('Вы уверены, что хотите удалить эту тренировку?')) return;
    
    const saved = DataManager.getTrainings();
    const updatedTrainings = saved.filter(training => training.id.toString() !== trainingId.toString());
    
    const success = DataManager.saveTrainings(updatedTrainings);
    
    if (success) {
        alert('✅ Тренировка удалена!');
        // ПЕРЕЗАГРУЖАЕМ ИСТОРИЮ
        loadTrainingHistory();
    } else {
        alert('❌ Ошибка при удалении тренировки');
    }
}

// СТАТИСТИКА
function switchStatsTab(tabName, clickedElement) {
    document.querySelectorAll('.stats-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.stats-tab-content').forEach(content => content.classList.remove('active'));
    
    clickedElement.classList.add('active');
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.add('active');
    
    statsCurrentTab = tabName;
    loadStatsTabData(tabName);
}

function loadStatsTabData(tabName) {
    const trainings = DataManager.getTrainings();
    
    switch(tabName) {
        case 'overview': loadOverviewStats(trainings); break;
        case 'progress': loadProgressStats(trainings); break;
        case 'balance': loadBalanceStats(trainings); break;
        case 'activity': loadActivityStats(trainings); break;
        case 'analysis': loadAnalysisStats(trainings); break;
    }
}

function loadOverviewStats(trainings) {
    loadRecords(trainings);
    loadMainMetrics(trainings);
    loadWeeklyGoals(trainings);
    loadDataStatistics(trainings);
}

function loadRecords(trainings) {
    const recordsGrid = document.getElementById('records-grid');
    const personalRecords = calculatePersonalRecords(trainings);
    
    if (Object.keys(personalRecords).length === 0) {
        recordsGrid.innerHTML = '<div class="empty-state"><div class="icon">🏆</div><p>Пока нет рекордов</p></div>';
        return;
    }
    
    let recordsHTML = '';
    Object.entries(personalRecords).slice(0, 6).forEach(([exercise, record]) => {
        const trendClass = record.trend > 0 ? 'positive' : record.trend < 0 ? 'negative' : '';
        recordsHTML += `
            <div class="record-card">
                <div class="record-exercise">${exercise}</div>
                <div class="record-weight">${record.weight}кг</div>
                <div class="record-progress ${trendClass}">
                    ${record.trend > 0 ? '+' : ''}${record.trend}кг за месяц
                </div>
            </div>
        `;
    });
    recordsGrid.innerHTML = recordsHTML;
}

function calculatePersonalRecords(trainings) {
    if (StatsCache.personalRecords && Date.now() - StatsCache.lastCalculation < 30000) {
        return StatsCache.personalRecords;
    }
    
    const records = {};
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            if (!exercise.name || !exercise.sets) return;
            const maxWeight = Math.max(...exercise.sets.map(set => set.weight || 0));
            const exerciseName = exercise.name;
            
            if (!records[exerciseName] || maxWeight > records[exerciseName].weight) {
                records[exerciseName] = { weight: maxWeight, date: training.date, trend: 0 };
            }
        });
    });
    
    Object.keys(records).forEach(exercise => {
        const recentTrainings = trainings.filter(t => {
            const trainingDate = new Date(t.date);
            return trainingDate >= oneMonthAgo && t.exercises.some(ex => ex.name === exercise);
        });
        
        if (recentTrainings.length > 1) {
            const weights = recentTrainings.map(t => {
                const ex = t.exercises.find(e => e.name === exercise);
                return Math.max(...ex.sets.map(s => s.weight || 0));
            });
            const trend = weights[weights.length - 1] - weights[0];
            records[exercise].trend = trend;
        }
    });
    
    StatsCache.personalRecords = records;
    StatsCache.lastCalculation = Date.now();
    
    return records;
}

function loadMainMetrics(trainings) {
    const consistency = calculateConsistency(trainings);
    const intensity = calculateAverageIntensity(trainings);
    const progress = calculateProgress(trainings);
    
    document.getElementById('consistency-value').textContent = consistency + '%';
    document.getElementById('intensity-value').textContent = intensity + '%';
    document.getElementById('progress-value').textContent = progress + '%';
    
    document.getElementById('consistency-progress').style.width = consistency + '%';
    document.getElementById('intensity-progress').style.width = intensity + '%';
    document.getElementById('progress-progress').style.width = Math.min(progress, 100) + '%';
}

function calculateConsistency(trainings) {
    if (trainings.length === 0) return 0;
    const last30Days = trainings.filter(t => {
        const trainingDate = new Date(t.date);
        const daysAgo = (Date.now() - trainingDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
    });
    const expectedWorkouts = 12;
    const actualWorkouts = last30Days.length;
    return Math.min(Math.round((actualWorkouts / expectedWorkouts) * 100), 100);
}

function calculateAverageIntensity(trainings) {
    if (trainings.length === 0) return 0;
    let totalIntensity = 0;
    let count = 0;
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            if (exercise.sets && exercise.sets.length > 0) {
                const validSets = exercise.sets.filter(set => set.weight > 0);
                if (validSets.length > 0) {
                    const avgWeight = validSets.reduce((sum, set) => sum + set.weight, 0) / validSets.length;
                    totalIntensity += avgWeight;
                    count++;
                }
            }
        });
    });
    return count > 0 ? Math.round((totalIntensity / count) / 100 * 100) : 0;
}

function calculateProgress(trainings) {
    if (trainings.length < 2) return 0;
    const recentTrainings = trainings.slice(-5);
    const olderTrainings = trainings.slice(0, Math.min(5, trainings.length - 1));
    const recentVolume = calculateTotalVolume(recentTrainings);
    const olderVolume = calculateTotalVolume(olderTrainings);
    if (olderVolume === 0) return 100;
    const progress = ((recentVolume - olderVolume) / olderVolume) * 100;
    return Math.round(Math.max(progress, 0));
}

function calculateTotalVolume(trainings) {
    return trainings.reduce((total, training) => {
        return total + training.exercises.reduce((exerciseTotal, exercise) => {
            return exerciseTotal + exercise.sets.reduce((setTotal, set) => {
                return setTotal + ((set.weight || 0) * (set.reps || 0));
            }, 0);
        }, 0);
    }, 0);
}

function loadWeeklyGoals(trainings) {
    const weeklyGoals = document.getElementById('weekly-goals');
    const currentWeekTrainings = getCurrentWeekTrainings(trainings);
    const goals = [
        { name: 'Тренировки', target: 3, current: currentWeekTrainings.length },
        { name: 'Объем', target: 30000, current: calculateTotalVolume(currentWeekTrainings) },
        { name: 'Рекорды', target: 1, current: countNewRecords(currentWeekTrainings, trainings) }
    ];
    
    let goalsHTML = '';
    goals.forEach(goal => {
        const percentage = Math.min(Math.round((goal.current / goal.target) * 100), 100);
        const displayValue = goal.name === 'Объем' ? 
            `${(goal.current/1000).toFixed(0)}К/${goal.target/1000}К` : 
            `${goal.current}/${goal.target}`;
        
        goalsHTML += `
            <div class="goal-item">
                <div class="goal-info">
                    <div class="goal-header">
                        <span class="goal-name">${goal.name}</span>
                        <div class="goal-value">${displayValue}</div>
                    </div>
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill ${percentage < 50 ? 'warning' : ''}" 
                             style="width: ${percentage}%">
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    weeklyGoals.innerHTML = goalsHTML;
}

function loadDataStatistics(trainings) {
    const totalExercises = trainings.reduce((total, training) => total + training.exercises.length, 0);
    
    let statsSection = document.getElementById('data-statistics-section');
    
    if (!statsSection) {
        // Создаем блок если его нет
        const statsHTML = `
            <div class="stats-section" id="data-statistics-section">
                <h4>Статистика данных</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${trainings.length}</div>
                        <div class="stat-label">Всего тренировок</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${totalExercises}</div>
                        <div class="stat-label">Всего упражнений</div>
                    </div>
                </div>
            </div>
        `;
        
        const weeklyGoals = document.getElementById('weekly-goals');
        if (weeklyGoals) {
            weeklyGoals.insertAdjacentHTML('afterend', statsHTML);
        }
    } else {
        // Обновляем данные в существующем блоке
        const statValues = statsSection.querySelectorAll('.stat-value');
        statValues[0].textContent = trainings.length;
        statValues[1].textContent = totalExercises;
    }
}

function getCurrentWeekTrainings(trainings) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return trainings.filter(training => new Date(training.date) >= startOfWeek);
}

function countNewRecords(currentTrainings, allTrainings) {
    let newRecords = 0;
    const previousRecords = calculatePersonalRecords(allTrainings.filter(t => !currentTrainings.includes(t)));
    currentTrainings.forEach(training => {
        training.exercises.forEach(exercise => {
            if (!exercise.name || !exercise.sets) return;
            const maxWeight = Math.max(...exercise.sets.map(set => set.weight || 0));
            const previousRecord = previousRecords[exercise.name]?.weight || 0;
            if (maxWeight > previousRecord) newRecords++;
        });
    });
    return newRecords;
}

function loadProgressStats(trainings) {
    updateExerciseSelect();
    if (trainings.length > 0) updateProgressChart();
    loadRecordsHistory(trainings);
}

function loadRecordsHistory(trainings) {
    const recordsHistory = document.getElementById('records-history');
    const personalRecords = calculatePersonalRecords(trainings);
    
    if (Object.keys(personalRecords).length === 0) {
        recordsHistory.innerHTML = '<div class="empty-state"><div class="icon">📈</div><p>Нет истории рекордов</p></div>';
        return;
    }
    
    let historyHTML = '';
    Object.entries(personalRecords)
        .sort((a, b) => new Date(b[1].date) - new Date(a[1].date))
        .slice(0, 10)
        .forEach(([exercise, record]) => {
            historyHTML += `
                <div class="record-history-item">
                    <div class="record-history-exercise">${exercise}</div>
                    <div class="record-history-weight">${record.weight}кг</div>
                    <div class="record-history-date">${new Date(record.date).toLocaleDateString('ru-RU')}</div>
                </div>
            `;
        });
    recordsHistory.innerHTML = historyHTML;
}

function loadBalanceStats(trainings) {
    loadRadarChart(trainings);
    loadMuscleLoad(trainings);
    loadPushPullRatio(trainings);
}

function loadRadarChart(trainings) {
    const radarCtx = document.getElementById('radar-chart');
    if (!radarCtx) return;
    const abilities = calculateAbilities(trainings);
    
    if (radarChart) radarChart.destroy();
    
    // ЦВЕТА ДЛЯ ТЕМНОЙ ТЕМЫ
    radarChart = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Сила', 'Выносливость', 'Объем', 'Консистентность', 'Интенсивность'],
            datasets: [{
                label: 'Ваши способности',
                data: [abilities.strength, abilities.endurance, abilities.volume, abilities.consistency, abilities.intensity],
                backgroundColor: 'rgba(0, 212, 170, 0.2)',
                borderColor: '#00d4aa',
                pointBackgroundColor: '#00d4aa',
                pointBorderColor: '#ffffff',
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#00d4aa'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                r: { 
                    beginAtZero: true, 
                    max: 100, 
                    ticks: { 
                        stepSize: 20,
                        color: '#ffffff',
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: '#404040'
                    },
                    angleLines: {
                        color: '#404040'
                    },
                    pointLabels: {
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        }
                    }
                } 
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function calculateAbilities(trainings) {
    if (trainings.length === 0) return { strength: 0, endurance: 0, volume: 0, consistency: 0, intensity: 0 };
    const strength = Math.min(calculateAverageIntensity(trainings) * 1.5, 100);
    const endurance = Math.min(calculateConsistency(trainings) * 0.8, 100);
    const volume = Math.min((calculateTotalVolume(trainings) / 100000) * 100, 100);
    const consistency = calculateConsistency(trainings);
    const intensity = calculateAverageIntensity(trainings);
    return { strength, endurance, volume, consistency, intensity };
}

function loadMuscleLoad(trainings) {
    const muscleLoadGrid = document.getElementById('muscle-load-grid');
    const muscleLoad = calculateMuscleLoad(trainings);
    let loadHTML = '';
    Object.entries(muscleLoad).forEach(([muscle, load]) => {
        const percentage = Math.min(Math.round(load), 100);
        loadHTML += `
            <div class="muscle-load-item">
                <div class="muscle-load-name">${getMuscleGroupName(muscle)}</div>
                <div class="muscle-load-bar">
                    <div class="muscle-load-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="muscle-load-value">${percentage}%</div>
            </div>
        `;
    });
    muscleLoadGrid.innerHTML = loadHTML;
}

function calculateMuscleLoad(trainings) {
    if (StatsCache.muscleLoad && Date.now() - StatsCache.lastCalculation < 30000) {
        return StatsCache.muscleLoad;
    }
    
    const muscleGroups = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'traps', 'calves', 'cardio'];
    const load = {};
    muscleGroups.forEach(muscle => {
        load[muscle] = trainings.filter(training => {
            if (Array.isArray(training.type)) return training.type.includes(muscle);
            return training.type === muscle;
        }).length;
    });
    const maxLoad = Math.max(...Object.values(load));
    if (maxLoad > 0) {
        Object.keys(load).forEach(muscle => {
            load[muscle] = (load[muscle] / maxLoad) * 100;
        });
    }
    
    StatsCache.muscleLoad = load;
    StatsCache.lastCalculation = Date.now();
    
    return load;
}

function loadPushPullRatio(trainings) {
    const pushExercises = ['жим', 'отжимания', 'разгибания', 'махи'];
    const pullExercises = ['тяга', 'подтягивания', 'сгибания', 'шраги'];
    let pushCount = 0, pullCount = 0;
    
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            const name = exercise.name.toLowerCase();
            if (pushExercises.some(push => name.includes(push))) pushCount++;
            else if (pullExercises.some(pull => name.includes(pull))) pullCount++;
        });
    });
    
    const total = pushCount + pullCount;
    const pushPercentage = total > 0 ? Math.round((pushCount / total) * 100) : 50;
    const pullPercentage = 100 - pushPercentage;
    
    document.getElementById('push-side').style.width = pushPercentage + '%';
    document.getElementById('push-side').textContent = pushPercentage + '%';
    document.getElementById('pull-side').style.width = pullPercentage + '%';
    document.getElementById('pull-side').textContent = pullPercentage + '%';
}

function loadActivityStats(trainings) {
    loadActivityHeatmap(trainings);
    loadConsistencyStats(trainings);
}

function loadActivityHeatmap(trainings) {
    const heatmap = document.getElementById('activity-heatmap');
    const heatmapData = generateHeatmapData(trainings);
    
    if (heatmapData.length === 0) {
        heatmap.innerHTML = '<div class="empty-state"><div class="icon">📅</div><p>Недостаточно данных для отображения</p></div>';
        return;
    }
    
    let heatmapHTML = '';
    heatmapData.forEach(month => {
        heatmapHTML += `
            <div class="heatmap-month">
                <div class="heatmap-header">
                    <div class="heatmap-title">${month.name}</div>
                    <div class="heatmap-legend">
                        <span>Меньше</span>
                        <div class="heatmap-day intensity-1"></div>
                        <div class="heatmap-day intensity-2"></div>
                        <div class="heatmap-day intensity-3"></div>
                        <div class="heatmap-day intensity-4"></div>
                        <span>Больше</span>
                    </div>
                </div>
                <div class="heatmap-grid">
                    ${month.weeks.map(week => week.map(day => 
                        `<div class="heatmap-day intensity-${day.intensity} ${day.isToday ? 'today' : ''}"></div>`
                    ).join('')).join('')}
                </div>
            </div>
        `;
    });
    heatmap.innerHTML = heatmapHTML;
}

function generateHeatmapData(trainings) {
    const months = [];
    const now = new Date();
    
    for (let i = 2; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        const weeks = [];
        
        const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        
        let currentWeek = [];
        let currentDate = new Date(firstDay);
        
        for (let i = 0; i < firstDay.getDay(); i++) {
            currentWeek.push({ intensity: 0, isToday: false });
        }
        
        while (currentDate <= lastDay) {
            const hasTraining = trainings.some(training => {
                const trainingDate = new Date(training.date);
                return trainingDate.toDateString() === currentDate.toDateString();
            });
            
            const intensity = hasTraining ? Math.floor(Math.random() * 4) + 1 : 0;
            const isToday = currentDate.toDateString() === now.toDateString();
            
            currentWeek.push({ intensity, isToday });
            
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push({ intensity: 0, isToday: false });
            }
            weeks.push(currentWeek);
        }
        
        months.push({ name: monthName, weeks });
    }
    
    return months;
}

function loadConsistencyStats(trainings) {
    const currentStreak = calculateCurrentStreak(trainings);
    const bestStreak = calculateBestStreak(trainings);
    const missedWorkouts = calculateMissedWorkouts(trainings);
    document.getElementById('current-streak').textContent = currentStreak;
    document.getElementById('best-streak').textContent = bestStreak;
    document.getElementById('missed-workouts').textContent = missedWorkouts;
}

function calculateCurrentStreak(trainings) {
    if (trainings.length === 0) return 0;
    const sortedTrainings = trainings.sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 0;
    let currentDate = new Date();
    
    for (let training of sortedTrainings) {
        const trainingDate = new Date(training.date);
        const daysDiff = Math.floor((currentDate - trainingDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
            streak++;
        } else if (daysDiff > streak) {
            break;
        }
    }
    return streak;
}

function calculateBestStreak(trainings) {
    if (trainings.length === 0) return 0;
    const sortedTrainings = trainings.sort((a, b) => new Date(a.date) - new Date(b.date));
    let bestStreak = 0, currentStreak = 0;
    let lastDate = null;
    
    sortedTrainings.forEach(training => {
        const trainingDate = new Date(training.date);
        if (lastDate) {
            const daysDiff = Math.floor((trainingDate - lastDate) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 2) {
                currentStreak++;
            } else {
                bestStreak = Math.max(bestStreak, currentStreak);
                currentStreak = 1;
            }
        } else {
            currentStreak = 1;
        }
        lastDate = trainingDate;
    });
    
    return Math.max(bestStreak, currentStreak);
}

function calculateMissedWorkouts(trainings) {
    const last30Days = trainings.filter(t => {
        const daysAgo = (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
    });
    return Math.max(12 - last30Days.length, 0);
}

function loadAnalysisStats(trainings) {
    loadAnalysisReport(trainings);
    loadEffectiveExercises(trainings);
    loadRecommendations(trainings);
}

function loadAnalysisReport(trainings) {
    const analysisReport = document.getElementById('analysis-report');
    const report = generateAnalysisReport(trainings);
    analysisReport.innerHTML = `
        <div class="report-header">
            <div class="report-title">${report.title}</div>
            <div class="report-subtitle">${report.subtitle}</div>
        </div>
        <div class="report-section">
            <div class="report-section-title">Достижения</div>
            <ul class="achievement-list">
                ${report.achievements.map(ach => `<li>${ach}</li>`).join('')}
            </ul>
        </div>
        <div class="report-section">
            <div class="report-section-title">Тренды</div>
            <ul class="trend-list">
                ${report.trends.map(trend => `<li>${trend}</li>`).join('')}
            </ul>
        </div>
        <div class="report-section">
            <div class="report-section-title">Рекомендации</div>
            <ul class="recommendation-list">
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    `;
}

function generateAnalysisReport(trainings) {
    if (trainings.length === 0) {
        return {
            title: "Добро пожаловать!",
            subtitle: "Начните первую тренировку",
            achievements: ["Создайте первую тренировку чтобы начать отслеживать прогресс"],
            trends: ["Статистика появится после нескольких тренировок"],
            recommendations: ["Добавьте первую тренировку", "Регулярно отслеживайте прогресс"]
        };
    }
    
    const consistency = calculateConsistency(trainings);
    const volume = calculateTotalVolume(trainings);
    const records = Object.keys(calculatePersonalRecords(trainings)).length;
    
    let title, subtitle;
    if (consistency >= 80) {
        title = "Отличный месяц!";
        subtitle = "Вы проявляете замечательную регулярность";
    } else if (consistency >= 60) {
        title = "Хорошие результаты";
        subtitle = "Продолжайте в том же духе";
    } else {
        title = "Есть куда расти";
        subtitle = "Увеличьте регулярность тренировок";
    }
    
    const achievements = [];
    if (records > 0) achievements.push(`${records} новых рекордов в этом месяце`);
    if (consistency >= 70) achievements.push(`Регулярность ${consistency}% - отличный результат`);
    if (volume > 50000) achievements.push(`Общий объем ${Math.round(volume/1000)}к кг - мощная работа`);
    
    const trends = [];
    trends.push(`Регулярность: ${consistency}%`);
    trends.push(`Общий объем: ${Math.round(volume/1000)}к кг`);
    trends.push(`Количество рекордов: ${records}`);
    
    const recommendations = [];
    if (consistency < 70) recommendations.push("Увеличьте частоту тренировок до 3 раз в неделю");
    if (records === 0) recommendations.push("Попробуйте увеличить веса в основных упражнениях");
    recommendations.push("Следите за балансом нагрузки между группами мышц");
    
    return { title, subtitle, achievements, trends, recommendations };
}

function loadEffectiveExercises(trainings) {
    const effectiveExercises = document.getElementById('effective-exercises');
    const exercises = calculateExerciseEffectiveness(trainings);
    
    if (exercises.length === 0) {
        effectiveExercises.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>Недостаточно данных для анализа</p></div>';
        return;
    }
    
    let exercisesHTML = '';
    exercises.slice(0, 5).forEach((exercise, index) => {
        const progressClass = exercise.progress > 0 ? 'positive' : '';
        exercisesHTML += `
            <div class="exercise-rank">
                <div class="rank-number">${index + 1}</div>
                <div class="exercise-rank-info">
                    <div class="exercise-rank-name">${exercise.name}</div>
                    <div class="exercise-rank-progress ${progressClass}">Прогресс: +${exercise.progress}%</div>
                </div>
            </div>
        `;
    });
    effectiveExercises.innerHTML = exercisesHTML;
}

function calculateExerciseEffectiveness(trainings) {
    if (StatsCache.exerciseEffectiveness && Date.now() - StatsCache.lastCalculation < 30000) {
        return StatsCache.exerciseEffectiveness;
    }
    
    const exerciseStats = {};
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            if (!exercise.name || !exercise.sets) return;
            const exerciseName = exercise.name;
            if (!exerciseStats[exerciseName]) {
                exerciseStats[exerciseName] = { name: exerciseName, progress: 0, totalVolume: 0, count: 0 };
            }
            const volume = exercise.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
            exerciseStats[exerciseName].totalVolume += volume;
            exerciseStats[exerciseName].count++;
        });
    });
    
    Object.values(exerciseStats).forEach(exercise => {
        exercise.progress = exercise.count > 0 ? Math.round(exercise.totalVolume / exercise.count / 100) : 0;
    });
    
    const result = Object.values(exerciseStats).sort((a, b) => b.progress - a.progress).slice(0, 10);
    StatsCache.exerciseEffectiveness = result;
    StatsCache.lastCalculation = Date.now();
    
    return result;
}

function loadRecommendations(trainings) {
    const recommendations = document.getElementById('recommendations');
    const recs = generateRecommendations(trainings);
    let recsHTML = '';
    recs.forEach(rec => {
        recsHTML += `
            <div class="recommendation-item">
                <div class="recommendation-icon">💡</div>
                <div class="recommendation-text">${rec}</div>
            </div>
        `;
    });
    recommendations.innerHTML = recsHTML;
}

function generateRecommendations(trainings) {
    const recommendations = [];
    const consistency = calculateConsistency(trainings);
    const muscleLoad = calculateMuscleLoad(trainings);
    
    if (consistency < 70) recommendations.push("Старайтесь тренироваться 3 раза в неделю для лучшего прогресса");
    if (muscleLoad.chest > muscleLoad.back * 1.5) recommendations.push("Добавьте больше упражнений на спину для баланса");
    if (muscleLoad.legs < 50) recommendations.push("Не забывайте про тренировку ног - это основа силовых показателей");
    if (trainings.length > 10) recommendations.push("Рассмотрите возможность периодизации нагрузок для преодоления плато");
    
    if (recommendations.length === 0) {
        recommendations.push("Продолжайте текущую программу - вы на правильном пути!");
        recommendations.push("Следите за восстановлением и качеством сна");
    }
    return recommendations.slice(0, 3);
}

// СТАТИСТИКА КАРДИО
function calculateCardioStats(trainings) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let totalTime = 0;
    let weeklyTime = 0;
    const popularExercises = {};
    
    trainings.forEach(training => {
        if (training.cardio && training.cardio.length > 0) {
            training.cardio.forEach(cardio => {
                // Общее время
                totalTime += cardio.time;
                
                // Время за неделю
                const trainingDate = new Date(training.date);
                if (trainingDate >= oneWeekAgo) {
                    weeklyTime += cardio.time;
                }
                
                // Популярные упражнения
                if (!popularExercises[cardio.name]) {
                    popularExercises[cardio.name] = 0;
                }
                popularExercises[cardio.name]++;
            });
        }
    });
    
    // Сортируем по популярности
    const sortedPopular = Object.entries(popularExercises)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    return {
        totalTime,
        weeklyTime,
        popularExercises: sortedPopular
    };
}

// ОТОБРАЗИТЬ СТАТИСТИКУ КАРДИО
function displayCardioStats(trainings) {
    const stats = calculateCardioStats(trainings);
    
    // Создаем или находим секцию для кардио статистики
    let cardioStatsSection = document.getElementById('cardio-stats-section');
    
    if (!cardioStatsSection) {
        cardioStatsSection = document.createElement('div');
        cardioStatsSection.id = 'cardio-stats-section';
        cardioStatsSection.className = 'stats-section';
        cardioStatsSection.innerHTML = `
            <h4>🏃 Статистика кардио</h4>
            <div class="cardio-stats-grid">
                <div class="cardio-stat-card">
                    <div class="cardio-stat-value">${stats.weeklyTime}</div>
                    <div class="cardio-stat-label">Минут за неделю</div>
                </div>
                <div class="cardio-stat-card">
                    <div class="cardio-stat-value">${stats.totalTime}</div>
                    <div class="cardio-stat-label">Всего минут</div>
                </div>
            </div>
            <div class="popular-cardio">
                <h5>🎯 Популярные кардио упражнения</h5>
                <div class="popular-cardio-list">
                    ${stats.popularExercises.map(([exercise, count]) => `
                        <div class="popular-cardio-item">
                            <span class="cardio-exercise-name">${exercise}</span>
                            <span class="cardio-exercise-count">${count} раз</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Добавляем в конец статистики
        const statsContainer = document.querySelector('#stats .card');
        if (statsContainer) {
            statsContainer.appendChild(cardioStatsSection);
        }
    } else {
        // Обновляем существующую секцию
        cardioStatsSection.querySelector('.cardio-stat-value').textContent = stats.weeklyTime;
        cardioStatsSection.querySelectorAll('.cardio-stat-value')[1].textContent = stats.totalTime;
        
        const popularList = cardioStatsSection.querySelector('.popular-cardio-list');
        popularList.innerHTML = stats.popularExercises.map(([exercise, count]) => `
            <div class="popular-cardio-item">
                <span class="cardio-exercise-name">${exercise}</span>
                <span class="cardio-exercise-count">${count} раз</span>
            </div>
        `).join('');
    }
}

function loadStatistics() {
    loadStatsTabData(statsCurrentTab);
    
    const saved = DataManager.getTrainings();
    
    const totalTrainingsElement = document.getElementById('total-trainings-count');
    const totalExercisesElement = document.getElementById('total-exercises-count');
    
    if (totalTrainingsElement) totalTrainingsElement.textContent = saved.length;
    if (totalExercisesElement) {
        const totalExercises = saved.reduce((total, training) => total + training.exercises.length, 0);
        totalExercisesElement.textContent = totalExercises;
    }
    
    calculateMaxWeights(saved);
    
    // ДОБАВЬ ЭТУ СТРОКУ:
    displayCardioStats(saved);
}

function calculateMaxWeights(trainings) {
    const maxWeights = { 
        'chest': { weight: 0, exercise: '' }, 
        'back': { weight: 0, exercise: '' }, 
        'legs': { weight: 0, exercise: '' }, 
        'shoulders': { weight: 0, exercise: '' }, 
        'biceps': { weight: 0, exercise: '' }, 
        'triceps': { weight: 0, exercise: '' } 
    };
    const exerciseToMuscleGroup = {
        'жим лежа': 'chest', 'жим штанги лежа': 'chest', 'жим гантелей лежа': 'chest', 'жим в наклоне': 'chest', 'разводка гантелей': 'chest', 'бабочка': 'chest', 'пуловер': 'chest', 'отжимания': 'chest', 'брусья': 'chest',
        'становая тяга': 'back', 'тяга штанги': 'back', 'тяга гантели': 'back', 'тяга т-грифа': 'back', 'подтягивания': 'back', 'верхняя тяга': 'back', 'нижняя тяга': 'back', 'гиперэкстензия': 'back', 'шраги': 'back',
        'приседания': 'legs', 'присед': 'legs', 'жим ногами': 'legs', 'разгибание ног': 'legs', 'сгибание ног': 'legs', 'выпады': 'legs', 'румынская тяга': 'legs', 'подъем на носки': 'legs', 'ягодичный мост': 'legs',
        'жим штанги стоя': 'shoulders', 'жим гантелей сидя': 'shoulders', 'армейский жим': 'shoulders', 'махи гантелями': 'shoulders', 'разводка в стороны': 'shoulders', 'тяга к подбородку': 'shoulders',
        'подъем штанги': 'biceps', 'подъем гантелей': 'biceps', 'молотки': 'biceps', 'концентрированный подъем': 'biceps', 'подъем на скамье скотта': 'biceps', 'бицепс': 'biceps',
        'жим лежа узким хватом': 'triceps', 'французский жим': 'triceps', 'разгибание на блоке': 'triceps', 'отжимания на брусьях': 'triceps', 'кикбэки': 'triceps', 'трицепс': 'triceps'
    };
    trainings.forEach(training => {
        training.exercises.forEach(exercise => {
            if (exercise.sets && exercise.sets.length > 0) {
                const maxWeightInExercise = Math.max(...exercise.sets.map(set => set.weight || 0));
                let muscleGroup = null;
                const exerciseName = exercise.name.toLowerCase();
                for (const [key, group] of Object.entries(exerciseToMuscleGroup)) {
                    if (exerciseName.includes(key)) { muscleGroup = group; break; }
                }
                if (!muscleGroup) muscleGroup = Array.isArray(training.type) ? training.type[0] : training.type;
                if (muscleGroup && maxWeights[muscleGroup] && maxWeightInExercise > maxWeights[muscleGroup].weight) {
                    maxWeights[muscleGroup].weight = maxWeightInExercise;
                    maxWeights[muscleGroup].exercise = exercise.name;
                }
            }
        });
    });
    updateMaxWeightsUI(maxWeights);
}

function updateMaxWeightsUI(maxWeights) {
    const groups = ['chest', 'legs', 'back', 'shoulders', 'biceps', 'triceps'];
    groups.forEach(group => {
        const weightElement = document.getElementById(`max-${group}-weight`);
        const exerciseElement = document.getElementById(`max-${group}-exercise`);
        if (maxWeights[group].weight > 0) {
            weightElement.textContent = maxWeights[group].weight + ' кг';
            exerciseElement.textContent = maxWeights[group].exercise;
        } else {
            weightElement.textContent = '- кг';
            exerciseElement.textContent = '-';
        }
    });
}

function updateExerciseSelect() {
    const saved = DataManager.getTrainings();
    const select = document.getElementById('exercise-select');
    
    if (!select) {
        console.log('ℹ️ Селектор упражнений не найден');
        return;
    }
    
    const currentSelection = select.value;
    select.innerHTML = '<option value="">Выберите упражнение</option>';
    const allExercises = new Set();
    
    saved.forEach(training => {
        training.exercises.forEach(exercise => {
            if (exercise.name && exercise.name.trim()) {
                allExercises.add(exercise.name);
            }
        });
    });
    
    const sortedExercises = Array.from(allExercises).sort();
    sortedExercises.forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise; 
        option.textContent = exercise;
        select.appendChild(option);
    });
    
    if (currentSelection && allExercises.has(currentSelection)) {
        select.value = currentSelection;
    } else if (sortedExercises.length > 0) {
        select.value = sortedExercises[0];
    }
    
    if (saved.length > 0 && allExercises.size > 0) {
        updateProgressChart();
    }
}

function updateProgressChart() {
    const exerciseSelect = document.getElementById('exercise-select');
    if (!exerciseSelect) return;
    
    const exerciseName = exerciseSelect.value;
    if (!exerciseName || !progressChart || !volumeChart) return;
    
    const saved = DataManager.getTrainings();
    const exerciseData = [];
    saved.forEach(training => {
        const exercise = training.exercises.find(ex => ex.name === exerciseName);
        if (exercise && exercise.sets.length > 0) {
            const maxWeight = Math.max(...exercise.sets.map(set => set.weight || 0));
            const volume = exercise.sets.reduce((sum, set) => sum + ((set.weight || 0) * (set.reps || 0)), 0);
            exerciseData.push({ date: training.date, weight: maxWeight, volume: volume });
        }
    });
    
    exerciseData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (exerciseData.length > 0) {
        progressChart.data.labels = exerciseData.map(item => new Date(item.date).toLocaleDateString('ru-RU'));
        progressChart.data.datasets[0].data = exerciseData.map(item => item.weight);
        progressChart.data.datasets[0].label = `${exerciseName} (вес)`;
        progressChart.update();
        
        volumeChart.data.labels = exerciseData.map(item => new Date(item.date).toLocaleDateString('ru-RU'));
        volumeChart.data.datasets[0].data = exerciseData.map(item => item.volume);
        volumeChart.data.datasets[0].label = `${exerciseName} (объем)`;
        volumeChart.update();
    }
}

// УПРАВЛЕНИЕ ДАННЫМИ
function getMuscleGroupName(type) {
    return muscleGroupMapping[type] || type;
}

// АВТОДОПОЛНЕНИЕ
function initAutocomplete() {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.exercise-suggestions') && !e.target.classList.contains('.exercise-name')) {
            hideSuggestions();
        }
    });
    
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('exercise-name')) {
            clearTimeout(suggestionsTimeout);
            suggestionsTimeout = setTimeout(() => showExerciseSuggestions(e.target), 300);
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') hideSuggestions();
    });
}

function showExerciseSuggestions(inputElement) {
    const query = inputElement.value.trim();
    const suggestionsContainer = document.getElementById('exercise-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');
    
    // ЕСЛИ ПОЛЕ ПУСТОЕ - СКРЫВАЕМ И ВЫХОДИМ
    if (!query) {
        hideSuggestions();
        return;
    }
    
    if (!query) {
        showExerciseSuggestionsByGroups(suggestionsList, inputElement);
    } else {
        showMatchingExercises(query, suggestionsList, inputElement);
    }
    
    const inputRect = inputElement.getBoundingClientRect();
    const appContainer = document.querySelector('.app');
    const appRect = appContainer.getBoundingClientRect();
    
    // Сначала показываем контейнер, чтобы узнать его высоту
    suggestionsContainer.style.display = 'block';
    const suggestionsHeight = suggestionsContainer.offsetHeight;
    
    // ПОЗИЦИОНИРУЕМ НАД полем ввода
    suggestionsContainer.style.position = 'absolute';
    suggestionsContainer.style.top = (inputRect.top - appRect.top - suggestionsHeight - 5) + 'px'; // 5px отступ снизу
    suggestionsContainer.style.left = (inputRect.left - appRect.left) + 'px';
    suggestionsContainer.style.width = inputRect.width + 'px';
    suggestionsContainer.style.bottom = 'auto'; // Убираем bottom позиционирование
    
    const backdrop = document.createElement('div');
    backdrop.className = 'suggestions-backdrop show';
    backdrop.onclick = hideSuggestions;
    document.body.appendChild(backdrop);
    currentExerciseInput = inputElement;
}

function showExerciseSuggestionsByGroups(suggestionsList, inputElement) {
    let exercises = [];
    
    if (selectedMuscleGroups.length > 0) {
        exercises = Object.keys(exerciseDatabase).filter(exerciseName => {
            const exerciseGroups = exerciseDatabase[exerciseName];
            return selectedMuscleGroups.some(group => exerciseGroups.includes(group));
        });
    } else {
        exercises = Object.keys(exerciseDatabase);
    }
    
    suggestionsList.innerHTML = '';
    
    if (exercises.length === 0) {
        suggestionsList.innerHTML = '<div class="suggestion-item">Нет упражнений для выбранных групп</div>';
        return;
    }
    
    // ❌ СТАРОЕ (убогое):
    // exercises.slice(0, 8).forEach(exerciseName => {
    //     const suggestionItem = document.createElement('button');
    //     suggestionItem.className = 'suggestion-item';
    //     
    //     const exerciseGroups = exerciseDatabase[exerciseName] || [];
    //     const groupNames = exerciseGroups.map(g => muscleGroupMapping[g]).filter(name => name).join(', ');
    //     
    //     suggestionItem.innerHTML = `
    //         <span class="exercise-name">${exerciseName}</span>
    //         ${groupNames ? `<span class="exercise-groups">${groupNames}</span>` : ''}
    //     `;
    
    // ✅ НОВОЕ (красивое, как в кардио):
    exercises.slice(0, 8).forEach(exerciseName => {
        const exerciseGroups = exerciseDatabase[exerciseName] || [];
        const groupNames = exerciseGroups.map(g => muscleGroupMapping[g]).filter(name => name).join(', ');
        
        const suggestionHTML = `
            <div class="suggestion-item" onclick="this.onclick = function(){document.querySelector('.exercise-name').value='${exerciseName}'; hideSuggestions();}">
                <span class="exercise-icon">🏋️</span>
                <span class="exercise-name-suggestion">${exerciseName}</span>
                ${groupNames ? `<span class="exercise-groups">${groupNames}</span>` : ''}
            </div>
        `;
        
        suggestionsList.insertAdjacentHTML('beforeend', suggestionHTML);
    });
}

function showMatchingExercises(query, suggestionsList, inputElement) {
    const normalizedQuery = query.toLowerCase().trim(); // ← ДОБАВЬ ЭТУ СТРОЧКУ

    let matchingExercises = [];
    const allExercises = UserExerciseManager.getAllExercises();
    
    // БАЗА СИНОНИМОВ ДЛЯ ПОИСКА
    const synonyms = {
        // Жим лежа
        'жим лежа': 'Жим штанги лежа',
        'бенч пресс': 'Жим штанги лежа',
        'бенч': 'Жим штанги лежа',
        'bench press': 'Жим штанги лежа',
        'bench': 'Жим штанги лежа',
        'жим на горизонтальной': 'Жим штанги лежа',
        'жим на горизонталке': 'Жим штанги лежа',
        'жим на скамье': 'Жим штанги лежа',
        'классический жим': 'Жим штанги лежа',
        'жим штанги': 'Жим штанги лежа',
        'flat bench': 'Жим штанги лежа',
        'жим от груди': 'Жим штанги лежа',
        'грудной жим': 'Жим штанги лежа',
        
        // Жим на наклонной
        'жим на наклонной': 'Жим штанги на скамье с наклоном',
        'жим под углом': 'Жим штанги на скамье с наклоном',
        'incline bench': 'Жим штанги на скамье с наклоном',
        'инклайн бенч': 'Жим штанги на скамье с наклоном',
        'жим головой вверх': 'Жим штанги на скамье с наклоном',
        'жим вверх': 'Жим штанги на скамье с наклоном',
        'жим на наклонной скамье': 'Жим штанги на скамье с наклоном',
        
        // Жим гантелей
        'жим гантелей': 'Жим гантелей лежа',
        'гантельный жим': 'Жим гантелей лежа',
        'dumbbell press': 'Жим гантелей лежа',
        'дмбл пресс': 'Жим гантелей лежа',
        
        // Отжимания на брусьях
        'брусья': 'Отжимания на брусьях (с наклоном вперед)',
        'дипы': 'Отжимания на брусьях (с наклоном вперед)',
        'dips': 'Отжимания на брусьях (с наклоном вперед)',
        'отжимания': 'Отжимания на брусьях (с наклоном вперед)',
        'грудные брусья': 'Отжимания на брусьях (с наклоном вперед)',
        'дипсы': 'Отжимания на брусьях (с наклоном вперед)',
        
        // Разводки
        'разводка': 'Разведение гантелей лежа',
        'разводки': 'Разведение гантелей лежа',
        'флай': 'Разведение гантелей лежа',
        'fly': 'Разведение гантелей лежа',
        'флайес': 'Разведение гантелей лежа',
        'махи гантелями лежа': 'Разведение гантелей лежа',
        
        // Кроссоверы
        'кроссовер': 'Кроссоверы через верхние блоки',
        'crossover': 'Кроссоверы через верхние блоки',
        'сведение в кроссовере': 'Кроссоверы через верхние блоки',
        'бабочка': 'Пек-дек (бабочка)',
        'пек дек': 'Пек-дек (бабочка)',
        'pec deck': 'Пек-дек (бабочка)',
        'баттерфляй': 'Пек-дек (бабочка)',

        // ========== НОГИ ==========
        // Приседания
        'присед': 'Приседания со штангой',
        'сквот': 'Приседания со штангой',
        'squat': 'Приседания со штангой',
        'базовый присед': 'Приседания со штангой',
        'классические приседания': 'Приседания со штангой',
        'приседания со штангой на спине': 'Приседания со штангой',
        'присед со штангой': 'Приседания со штангой',
        'присяд': 'Приседания со штангой',
        
        // Становая тяга
        'становая': 'Становая тяга',
        'дэдлифт': 'Становая тяга',
        'deadlift': 'Становая тяга',
        'тяга становая': 'Становая тяга',
        'классическая становая': 'Становая тяга',
        'становая на прямых ногах': 'Румынская становая тяга с гантелями',
        'румынская': 'Румынская становая тяга с гантелями',
        'румынка': 'Румынская становая тяга с гантелями',
        'russian deadlift': 'Румынская становая тяга с гантелями',
        'rdl': 'Румынская становая тяга с гантелями',
        
        // Жим ногами
        'жим ногами': 'Жим ногами',
        'leg press': 'Жим ногами',
        'жим платформы': 'Жим ногами',
        'ножной жим': 'Жим ногами',
        'платформа': 'Жим ногами',
        
        // Выпады
        'выпады': 'Выпады со штангой',
        'lunges': 'Выпады со штангой',
        'ланджи': 'Выпады со штангой',
        'выпад': 'Выпады со штангой',
        'шаги выпадами': 'Выпады со штангой',
        
        // Разгибания/сгибания ног
        'разгибания': 'Разгибания ног',
        'экстензия': 'Разгибания ног',
        'extension': 'Разгибания ног',
        'квадрицепс': 'Разгибания ног',
        'квадры': 'Разгибания ног',
        'сгибания': 'Сгибание ног лежа',
        'флекс': 'Сгибание ног лежа',
        'flexion': 'Сгибание ног лежа',
        'бицепс бедра': 'Сгибание ног лежа',
        'хамстрингс': 'Сгибание ног лежа',
        
        // Икры
        'подъем на носки': 'Подъемы на носки стоя',
        'calf raises': 'Подъемы на носки стоя',
        'икры стоя': 'Подъемы на носки стоя',
        'подъем на носки стоя': 'Подъемы на носки стоя',
        'голень': 'Подъемы на носки стоя',

        // ========== СПИНА ==========
        // Тяга штанги
        'тяга в наклоне': 'Тяга штанги в наклоне',
        'тяга штанги': 'Тяга штанги в наклоне',
        'bent over row': 'Тяга штанги в наклоне',
        'бор': 'Тяга штанги в наклоне',
        'тяга к поясу': 'Тяга штанги в наклоне',
        'наклонная тяга': 'Тяга штанги в наклоне',
        
        // Тяга гантели
        'тяга гантели': 'Тяга гантели одной рукой в наклоне',
        'гантельная тяга': 'Тяга гантели одной рукой в наклоне',
        'dumbbell row': 'Тяга гантели одной рукой в наклоне',
        'тяга одной рукой': 'Тяга гантели одной рукой в наклоне',
        'однорукая тяга': 'Тяга гантели одной рукой в наклоне',
        
        // Подтягивания
        'подтягивания': 'Подтягивания на перекладине',
        'pull ups': 'Подтягивания на перекладине',
        'чинупы': 'Подтягивания на перекладине',
        'подтягивания широким хватом': 'Подтягивания на перекладине',
        'подтягивания к груди': 'Подтягивания на перекладине',
        
        // Тяга верхнего блока
        'верхняя тяга': 'Тяга верхнего блока широким хватом',
        'тяга сверху': 'Тяга верхнего блока широким хватом',
        'lat pulldown': 'Тяга верхнего блока широким хватом',
        'пулдаун': 'Тяга верхнего блока широким хватом',
        'тяга за голову': 'Тяга верхнего блока широким хватом',
        'вертикальная тяга': 'Тяга верхнего блока широким хватом',
        
        // Тяга нижнего блока
        'нижняя тяга': 'Тяга нижнего блока к поясу сидя',
        'горизонтальная тяга': 'Тяга нижнего блока к поясу сидя',
        'seated row': 'Тяга нижнего блока к поясу сидя',
        'тяга к животу': 'Тяга нижнего блока к поясу сидя',
        'rowing': 'Тяга нижнего блока к поясу сидя',
        
        // Шраги
        'шраги': 'Шраги со штангой',
        'shrugs': 'Шраги со штангой',
        'трапеции': 'Шраги со штангой',
        'трапы': 'Шраги со штангой',
        'пожимания': 'Шраги со штангой',

        // ========== ПЛЕЧИ ==========
        // Жим штанги стоя
        'армейский жим': 'Жим штанги стоя (армейский жим)',
        'overhead press': 'Жим штанги стоя (армейский жим)',
        'жим над головой': 'Жим штанги стоя (армейский жим)',
        'военный жим': 'Жим штанги стоя (армейский жим)',
        'жим с груди': 'Жим штанги стоя (армейский жим)',
        'жим стоя': 'Жим штанги стоя (армейский жим)',
        
        // Махи гантелями
        'махи': 'Разведение гантелей стоя',
        'махи гантелями': 'Разведение гантелей стоя',
        'боковые махи': 'Разведение гантелей стоя',
        'lateral raises': 'Разведение гантелей стоя',
        'латеральные подъемы': 'Разведение гантелей стоя',
        'подъемы через стороны': 'Разведение гантелей стоя',
        
        // Подъемы перед собой
        'передние махи': 'Подъем гантелей перед собой',
        'front raises': 'Подъем гантелей перед собой',
        'подъемы вперед': 'Подъем гантелей перед собой',
        'махи вперед': 'Подъем гантелей перед собой',
        
        // Тяга к подбородку
        'протяжка': 'Тяга штанги к подбородку',
        'подъем штанги к подбородку': 'Тяга штанги к подбородку',
        'узкая тяга': 'Тяга штанги к подбородку',
        'upright row': 'Тяга штанги к подбородку',

        // ========== РУКИ ==========
        // Бицепс
        'бицепс': 'Подъем штанги на бицепс стоя',
        'подъем на бицепс': 'Подъем штанги на бицепс стоя',
        'сгибания рук': 'Подъем штанги на бицепс стоя',
        'байцепс': 'Подъем штанги на бицепс стоя',
        'biceps curl': 'Подъем штанги на бицепс стоя',
        'подъем штанги': 'Подъем штанги на бицепс стоя',
        'кёрл': 'Подъем штанги на бицепс стоя',
        'curl': 'Подъем штанги на бицепс стоя',
        
        // Молотки
        'молот': 'Молоток',
        'молотковые сгибания': 'Молоток',
        'hammer curl': 'Молоток',
        
        // Трицепс
        'трицепс': 'Французский жим лежа',
        'разгибания на трицепс': 'Французский жим лежа',
        'triceps extension': 'Французский жим лежа',
        'французский': 'Французский жим лежа',
        'skull crushers': 'Французский жим лежа',
        'сокрушители черепа': 'Французский жим лежа',
        
        // Жим узким хватом
        'узкий жим': 'Жим штанги узким хватом лежа',
        'close grip': 'Жим штанги узким хватом лежа',
        'жим для трицепса': 'Жим штанги узким хватом лежа',
        
        // Разгибания на блоке
        'разгибания на блоке': 'Жим книзу одной рукой обратным хватом',
        'pushdown': 'Жим книзу одной рукой обратным хватом',
        'пушаун': 'Жим книзу одной рукой обратным хватом',
        'блочные разгибания': 'Жим книзу одной рукой обратным хватом',

        // ========== ПРЕСС ==========
        // Скручивания
        'скручивания': 'Скручивания на скамье с наклоном вниз',
        'кранчи': 'Скручивания на скамье с наклоном вниз',
        'crunches': 'Скручивания на скамье с наклоном вниз',
        'пресс': 'Скручивания на скамье с наклоном вниз',
        'подъем корпуса': 'Скручивания на скамье с наклоном вниз',
        
        // Подъемы ног
        'подъемы ног': 'Подъемы ног в висе',
        'leg raises': 'Подъемы ног в висе',
        'вис': 'Подъемы ног в висе',
        'подъем коленей': 'Подъемы коленей в висе',
        'knee raises': 'Подъемы коленей в висе',
        
        // Планка
        'планка': 'Планка',
        'plank': 'Планка',
        'стойка в планке': 'Планка',
        'планка на локтях': 'Планка',
        
        // Русские скручивания
        'русские': 'Русские скручивания',
        'russian twist': 'Русские скручивания',
        'скручивания с поворотом': 'Русские скручивания'
    };
    
    // 1. Ищем по синонимам
    Object.entries(synonyms).forEach(([synonym, canonicalExercise]) => {
        if (query.includes(synonym) && allExercises[canonicalExercise]) {
            if (!matchingExercises.includes(canonicalExercise)) {
                matchingExercises.push(canonicalExercise);
            }
        }
    });
    
    // 2. Ищем прямые совпадения в названиях упражнений
    Object.keys(allExercises).forEach(exercise => {
        if (exercise.toLowerCase().includes(query.toLowerCase())) {
            if (!matchingExercises.includes(exercise)) {
                matchingExercises.push(exercise);
            }
        }
    });
    
    // 3. Если нашли по синонимам - показываем их первыми
    matchingExercises.sort((a, b) => {
        const aFromSynonym = Object.values(synonyms).includes(a);
        const bFromSynonym = Object.values(synonyms).includes(b);
        
        if (aFromSynonym && !bFromSynonym) return -1;
        if (!aFromSynonym && bFromSynonym) return 1;
        return a.localeCompare(b);
    });
    
    suggestionsList.innerHTML = '';
    
    if (matchingExercises.length === 0) {
        suggestionsList.innerHTML = '<div class="suggestion-item">Совпадений не найдено</div>';
        return;
    }
    
    matchingExercises.slice(0, 8).forEach(exerciseName => {
        const suggestionItem = document.createElement('button');
        suggestionItem.className = 'suggestion-item';
        
        const exerciseInfo = UserExerciseManager.getExerciseInfo(exerciseName);
        const groupNames = exerciseInfo.groups.map(g => muscleGroupMapping[g]).filter(name => name).join(', ');
        
        suggestionItem.innerHTML = `
            <span class="exercise-icon">${exerciseInfo.icon}</span>
            <span class="exercise-name-suggestion">${exerciseName}</span>
            ${groupNames ? `<span class="exercise-groups">${groupNames}</span>` : ''}
        `;
        
        suggestionItem.onclick = () => {
            inputElement.value = exerciseName;
            hideSuggestions();
            const weightInput = inputElement.closest('.exercise').querySelector('input[type="number"]');
            if (weightInput) setTimeout(() => weightInput.focus(), 100);
        };
        
        suggestionsList.appendChild(suggestionItem);
    });
}

function hideSuggestions() {
    const suggestionsContainer = document.getElementById('exercise-suggestions');
    suggestionsContainer.style.display = 'none';
    document.querySelectorAll('.suggestions-backdrop').forEach(backdrop => backdrop.remove());
    currentExerciseInput = null;
}

// ГРАФИКИ
function initCharts() {
    console.log("📊 Инициализация графиков...");
    const progressCtx = document.getElementById('progress-chart'); 
    const volumeCtx = document.getElementById('volume-chart');
    
    if (!progressCtx || !volumeCtx) return; 
    if (typeof Chart === 'undefined') { 
        showChartError(); 
        return; 
    }
    
    try {
        progressChart = new Chart(progressCtx, { 
            type: 'line', 
            data: { 
                labels: ['День 1', 'День 2', 'День 3'], 
                datasets: [{ 
                    label: 'Вес (кг)', 
                    data: [50, 52, 55], 
                    borderColor: '#3b82f6', 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                    tension: 0.3, 
                    fill: true 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            } 
        });
        
        volumeChart = new Chart(volumeCtx, { 
            type: 'bar', 
            data: { 
                labels: ['День 1', 'День 2', 'День 3'], 
                datasets: [{ 
                    label: 'Объем (кг)', 
                    data: [1000, 1100, 1200], 
                    backgroundColor: '#10b981' 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            } 
        });
    } catch (error) { 
        console.error('Ошибка инициализации графиков:', error); 
        showChartError(); 
    }
}

function showChartError() {
    const charts = document.querySelectorAll('.chart-container'); 
    charts.forEach(chart => { 
        chart.innerHTML = '<div class="chart-error">Графики временно недоступны</div>'; 
    });
}

// ТАЙМЕР
function startTimer(seconds) {
    stopTimer(); 
    currentTimerSeconds = seconds; 
    const timerDisplay = document.getElementById('timer-display'); 
    
    // СРАЗУ ОБНОВЛЯЕМ ДИСПЛЕЙ С ВЫБРАННЫМ ВРЕМЕНЕМ
    const minutes = Math.floor(currentTimerSeconds / 60); 
    const secs = currentTimerSeconds % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    timerDisplay.classList.add('timer-pulse');
    restTimer = setInterval(() => {
        currentTimerSeconds--; 
        const minutes = Math.floor(currentTimerSeconds / 60); 
        const secs = currentTimerSeconds % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (currentTimerSeconds <= 10) timerDisplay.style.color = '#ff3b30';
        if (currentTimerSeconds <= 0) { 
            stopTimer(); 
            showAlert('⏰ Время отдыха закончилось!'); 
        }
    }, 1000);
}

function stopTimer() {
    if (restTimer) { 
        clearInterval(restTimer); 
        restTimer = null; 
    } 
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.classList.remove('timer-pulse'); 
    timerDisplay.style.color = 'white'; 
    timerDisplay.textContent = '01:30';
}

// DataManager
const DataManager = {
    getTrainings() { 
        try { 
            const trainings = JSON.parse(localStorage.getItem('trainings') || '[]'); 
            return trainings.map(training => { 
                if (typeof training.type === 'string') return { ...training, type: [training.type] }; 
                return training; 
            }); 
        } catch (error) { 
            console.error('Ошибка загрузки тренировок:', error); 
            return []; 
        } 
    },
    
    saveTrainings(trainings) { 
        try { 
            localStorage.setItem('trainings', JSON.stringify(trainings)); 
            return true; 
        } catch (error) { 
            console.error('Ошибка сохранения тренировок:', error); 
            return false; 
        } 
    },
    
    addTraining(training) { 
        const trainings = this.getTrainings(); 
        trainings.push({ ...training, id: Date.now(), createdAt: new Date().toISOString() }); 
        return this.saveTrainings(trainings); 
    },
    
    removeTraining(trainingId) { 
        const trainings = this.getTrainings().filter(t => t.id !== trainingId); 
        return this.saveTrainings(trainings); 
    },
    
    updateTraining(trainingId, updates) { 
        const trainings = this.getTrainings(); 
        const index = trainings.findIndex(t => t.id === trainingId); 
        if (index !== -1) { 
            trainings[index] = { ...trainings[index], ...updates }; 
            return this.saveTrainings(trainings); 
        } 
        return false; 
    }
};

function updateTrainingGroupsSummary(knownGroups = []) {
    console.log("🔄 ОБНОВЛЯЕМ СВОДКУ ГРУПП...", knownGroups);
    
    const summaryContainer = document.getElementById('selected-groups-display-modal');
    if (!summaryContainer) {
        console.log("❌ Контейнер сводки не найден!");
        return;
    }
    
    // Собираем ВСЕ группы мышц из тренировки:
    const allGroups = new Set();
    
    // 1. Добавляем известные группы (переданные параметром)
    knownGroups.forEach(group => allGroups.add(group));
    
    // 2. Группы из выбранных вверху (комбо-селектор)
    console.log("📌 Выбранные группы:", selectedMuscleGroups);
    selectedMuscleGroups.forEach(group => allGroups.add(group));
    
    // 3. Группы из выбранных в модалке для новых упражнений
    console.log("📌 Группы из модалки:", exerciseMuscleGroups);
    Object.values(exerciseMuscleGroups).forEach(groups => {
        groups.forEach(group => allGroups.add(group));
    });
    
    const groupsArray = Array.from(allGroups).filter(group => group && group !== 'other');
    console.log("📊 ИТОГОВЫЕ ГРУППЫ:", groupsArray);
    
    if (groupsArray.length === 0) {
        summaryContainer.innerHTML = '<span style="color: #a0aec0; font-size: 14px;">Группы мышц появятся после выбора...</span>';
        return;
    }
    
    // Сортируем группы для красивого отображения
    const sortedGroups = groupsArray.sort((a, b) => {
        const order = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'traps', 'calves', 'forearms', 'cardio'];
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
    
    summaryContainer.innerHTML = sortedGroups.map(group => `
        <span style="display: inline-flex; align-items: center; background: #00d4aa; color: black; padding: 8px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 2px;">
            ${getMuscleGroupIcon(group)} ${muscleGroupMapping[group] || group}
        </span>
    `).join('');
}

// Функция для обновления видимости лейблов кардио
function updateCardioLabels() {
    document.querySelectorAll('.cardio-field-group input').forEach(input => {
        const fieldGroup = input.closest('.cardio-field-group');
        if (input.value && input.value !== '') {
            fieldGroup.style.setProperty('--label-opacity', '0');
        } else {
            fieldGroup.style.setProperty('--label-opacity', '1');
        }
    });
}

// Обработчики событий для полей кардио
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('cardio-time') || 
        e.target.classList.contains('cardio-intensity') || 
        e.target.classList.contains('cardio-calories')) {
        updateCardioLabels();
    }
});

document.addEventListener('focusin', function(e) {
    if (e.target.classList.contains('cardio-time') || 
        e.target.classList.contains('cardio-intensity') || 
        e.target.classList.contains('cardio-calories')) {
        const fieldGroup = e.target.closest('.cardio-field-group');
        fieldGroup.style.setProperty('--label-opacity', '0');
    }
});

document.addEventListener('focusout', function(e) {
    if (e.target.classList.contains('cardio-time') || 
        e.target.classList.contains('cardio-intensity') || 
        e.target.classList.contains('cardio-calories')) {
        const fieldGroup = e.target.closest('.cardio-field-group');
        if (!e.target.value || e.target.value === '') {
            fieldGroup.style.setProperty('--label-opacity', '1');
        }
    }
});

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', initApp);