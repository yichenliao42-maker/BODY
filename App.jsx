import { useState } from 'react';

const weeklyPlan = {
  1: { day: '週一', type: '完全休息', diet: '🟢 零澱粉，控制總熱量赤字', tasks: ['讓身體徹底恢復'] },
  2: { day: '週二', type: '推力主導 (力量突破)', diet: '🍚 晚餐精確秤重 100g 澱粉', tasks: ['啞鈴平胸臥推 5x5 (挑戰30KG)', '上斜啞鈴肩推 3x8-10', '坐姿胸推機 3x10-12', '啞鈴側平舉 4x12-15', '滑輪三頭下壓 3x10-12', '🔥 15分鐘上坡快走 (Zone 2)'] },
  3: { day: '週三', type: '🏸 羽球日', diet: '🍌 訓前半根香蕉，場邊 EAA', tasks: ['1~1.5小時高強度跑動', '訓後補充戰神乳清 + 肌酸 7g'] },
  4: { day: '週四', type: '拉力主導 (肌肥大)', diet: '🍚 晚餐精確秤重 100g 澱粉', tasks: ['滑輪下拉 (寬握) 4x8-10', '坐姿繩索划船 3x10-12', '啞鈴單臂划船 3x8-10', '滑輪臉拉 3x12-15', '啞鈴錘式彎舉 3x10-12', '🔥 15分鐘階梯機 (Zone 2)'] },
  5: { day: '週五', type: '完全休息', diet: '🟢 零澱粉，控制總熱量赤字', tasks: ['讓神經系統休息，準備週末訓練'] },
  6: { day: '週六', type: '胸背線條補強', diet: '🍚 晚餐精確秤重 100g 澱粉', tasks: ['上斜啞鈴臥推 3x8-10', '反握滑輪下拉 3x10-12', '蝴蝶機飛鳥 3x12-15', '仰臥捲腹 3x15-20', '側板支撐 3x30秒/邊', '🔥 15分鐘飛輪 (Zone 2)'] },
  0: { day: '週日', type: '下肢器材與核心', diet: '🍚 晚餐精確秤重 100g 澱粉', tasks: ['45度腿推機 4x8-10', '啞鈴高腳杯深蹲 3x10-12', '坐姿腿伸展機 3x12-15', '坐姿腿彎舉機 3x10-12', '羅馬椅抬腿 3x12-15'] },
};

export default function FitnessApp() {
  const [activeTab, setActiveTab] = useState('today');
  
  const [tdeeGoal, setTdeeGoal] = useState(1900);
  const [consumedCalories, setConsumedCalories] = useState(0);
  const [calInput, setCalInput] = useState('');
  
  const [avgHeartRate, setAvgHeartRate] = useState('');

  const todayIndex = new Date().getDay(); 
  const todayPlan = weeklyPlan[todayIndex];
  
  const remainingCalories = tdeeGoal - consumedCalories;
  const progressPercent = Math.min((consumedCalories / tdeeGoal) * 100, 100);

  const handleAddCal = () => {
    if (calInput && !isNaN(calInput)) {
      setConsumedCalories(prev => prev + parseInt(calInput));
      setCalInput('');
    }
  };

  const handleResetCal = () => {
    if(window.confirm('確定要清空今日熱量紀錄嗎？')) {
      setConsumedCalories(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
      <header className="bg-red-600 text-white p-5 shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-black tracking-wider">SPIDER-FIT <span className="text-red-200">14%</span></h1>
        <p className="text-sm font-medium opacity-90 mt-1">兩年年資・專屬突破系統</p>
      </header>

      <main className="p-4">
        {activeTab === 'today' && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-red-500">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold text-gray-800">{todayPlan.day}任務</h2>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                  {todayPlan.type}
                </span>
              </div>
              <div className="bg-green-50 text-green-700 p-3 rounded-lg mt-3 font-medium text-sm flex items-start">
                <span className="text-lg mr-2 leading-none">💡</span>
                <span>{todayPlan.diet}</span>
              </div>
            </div>

            <h3 className="font-bold text-gray-500 mb-2 px-1">訓練清單 (點擊打勾)</h3>
            <div className="space-y-3">
              {todayPlan.tasks.map((task, idx) => (
                <label key={idx} className="flex items-center bg-white p-4 rounded-xl shadow-sm active:bg-gray-50 transition cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded-md border-gray-300 text-red-500 focus:ring-red-500 transition-all" />
                  <span className="ml-3 text-[15px] font-medium text-gray-700">{task}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diet' && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <h2 className="text-lg font-bold text-gray-600 mb-2">今日剩餘熱量 (kcal)</h2>
              <div className={`text-5xl font-black mb-4 ${remainingCalories < 0 ? 'text-red-500' : 'text-green-500'}`}>
                {remainingCalories}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${progressPercent > 100 ? 'bg-red-500' : 'bg-green-500'}`} 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 font-medium">
                <span>已攝取: {consumedCalories}</span>
                <span>目標: {tdeeGoal}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-bold text-gray-700 mb-3">紀錄熱量</h3>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={calInput}
                  onChange={(e) => setCalInput(e.target.value)}
                  placeholder="輸入大卡 (例: 450)" 
                  className="flex-1 border-2 border-gray-100 p-3 rounded-xl bg-gray-50 focus:border-red-300 focus:outline-none transition" 
                />
                <button 
                  onClick={handleAddCal}
                  className="bg-gray-800 text-white font-bold px-6 rounded-xl active:scale-95 transition"
                >
                  新增
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => setConsumedCalories(prev => prev + 120)} className="border border-gray-200 text-sm font-medium p-2 rounded-lg text-gray-600 active:bg-gray-100">高蛋白飲 (+120)</button>
                <button onClick={() => setConsumedCalories(prev => prev + 450)} className="border border-gray-200 text-sm font-medium p-2 rounded-lg text-gray-600 active:bg-gray-100">健康餐盒 (+450)</button>
                <button onClick={() => setConsumedCalories(prev => prev + 150)} className="border border-gray-200 text-sm font-medium p-2 rounded-lg text-gray-600 active:bg-gray-100">御飯糰 (+150)</button>
                <button onClick={() => setConsumedCalories(prev => prev + 130)} className="border border-gray-200 text-sm font-medium p-2 rounded-lg text-gray-600 active:bg-gray-100">100g 白飯 (+130)</button>
              </div>

              <button onClick={handleResetCal} className="w-full mt-4 text-xs text-red-400 underline py-2">
                清空今日紀錄
              </button>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="animate-fade-in space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">📈</span> 突破指標追蹤
              </h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="block text-sm font-bold text-gray-600 mb-2">週二臥推 5x5 重量 (KG)</label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="目前目標: 30" className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="block text-sm font-bold text-gray-600 mb-2">早晨空腹腰圍 (cm)</label>
                  <p className="text-xs text-gray-400 mb-2">※ 體脂下降的最真實指標，每週日早上量測</p>
                  <input type="number" placeholder="輸入腰圍..." className="w-full border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
              </div>
            </div>

            <div className={`bg-white rounded-2xl shadow-sm p-5 border-2 ${todayIndex === 3 ? 'border-blue-400' : 'border-transparent'}`}>
              <h2 className="text-lg font-bold mb-3 flex items-center text-gray-700">
                <span className="mr-2">🏸</span> 羽球日心率追蹤
              </h2>
              <p className="text-xs text-gray-400 mb-3">維持高心率是週三燃脂的關鍵</p>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  value={avgHeartRate}
                  onChange={(e) => setAvgHeartRate(e.target.value)}
                  placeholder="輸入平均心率 (bpm)" 
                  className="w-full border p-3 rounded-xl bg-gray-50 focus:outline-none" 
                />
                <button className="bg-blue-500 text-white font-bold px-4 py-3 rounded-xl whitespace-nowrap">
                  紀錄
                </button>
              </div>
            </div>
            
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-2 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20">
        <button 
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center p-2 transition ${activeTab === 'today' ? 'text-red-600 scale-110' : 'text-gray-400'}`}
        >
          <span className="text-2xl mb-1">📋</span>
          <span className="text-[10px] font-bold">任務清單</span>
        </button>
        <button 
          onClick={() => setActiveTab('diet')}
          className={`flex flex-col items-center p-2 transition ${activeTab === 'diet' ? 'text-red-600 scale-110' : 'text-gray-400'}`}
        >
          <span className="text-2xl mb-1">🥗</span>
          <span className="text-[10px] font-bold">熱量追蹤</span>
        </button>
        <button 
          onClick={() => setActiveTab('progress')}
          className={`flex flex-col items-center p-2 transition ${activeTab === 'progress' ? 'text-red-600 scale-110' : 'text-gray-400'}`}
        >
          <span className="text-2xl mb-1">📈</span>
          <span className="text-[10px] font-bold">數據成長</span>
        </button>
      </nav>
    </div>
  );
}
