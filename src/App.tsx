import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FiTrash2, FiMessageSquare, FiEdit2, FiX, FiCompass, FiList, FiChevronRight } from 'react-icons/fi';
import { LocationService } from './services/locationService';
import { calculateDistance } from './utils/geoUtils';
import type { UserData, Location, Place, Note } from './types';

function App() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [error, setError] = useState<string>('');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isNamingPlace, setIsNamingPlace] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [tempLocation, setTempLocation] = useState<Location | null>(null);
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [isDataPanelOpen, setIsDataPanelOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    note: string;
    placeName: string;
    timestamp: number;
    distance: number;
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    const data = LocationService.getData();
    if (data) {
      setUserData(data);
    }
  }, []);  const addCurrentLocationWithNote = () => {
    if (!navigator.geolocation) {
      setError('你的浏览器不支持地理位置功能');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now()
        };
        setTempLocation(location);
        setSelectedPlace('temp');
        setError('');
      },
      (err) => {
        console.error('Geolocation error:', err);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('请允许获取位置信息。如果已经禁止，请在浏览器设置中重新允许位置访问权限。');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('无法获取当前位置，请确保GPS已开启并且在可定位区域。');
            break;
          case err.TIMEOUT:
            setError('获取位置信息超时，请检查网络连接并重试。');
            break;
          default:
            setError('获取位置信息失败: ' + err.message);
        }
      },
      {
        enableHighAccuracy: true,  // 启用高精度定位
        timeout: 10000,            // 10秒超时
        maximumAge: 0              // 不使用缓存的位置信息
      }
    );
  };

  const getRecommendation = () => {
    if (!navigator.geolocation) {
      setError('你的浏览器不支持地理位置功能');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now()
        };
        
        const result = LocationService.getRandomNoteFromNearestPlace(location);
        if (result) {
          setRecommendation({
            note: result.note.content,
            placeName: result.place.name,
            timestamp: result.note.timestamp,
            distance: calculateDistance(location, result.place.locations[0]),
            latitude: result.place.locations[0].latitude,
            longitude: result.place.locations[0].longitude
          });
          setError('');
        } else {
          setError('没有找到附近的备注');
        }
      },
      (err) => {
        setError('无法获取位置信息: ' + err.message);
      }
    );
  };  const handleCreatePlaceWithNote = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tempLocation || !newPlaceName.trim()) return;

    const newData = LocationService.createPlace(newPlaceName.trim(), tempLocation);
    if (newData && noteContent.trim()) {
      LocationService.addNoteToPlace(newData.places[newData.places.length - 1].id, noteContent.trim());
    }
    setUserData(newData);
    setIsNamingPlace(false);
    setNoteContent('');
    setSelectedPlace(null);
    setNewPlaceName('');
    setRecommendation(null);
  };

  const handleAddNote = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!noteContent.trim() || !tempLocation) return;

    // 检查是否在已有地点的100米范围内
    const existingPlace = LocationService.findNearbyPlace(tempLocation);
    
    if (existingPlace) {
      // 如果是已有地点，直接添加备注
      const newData = LocationService.addLocationToPlace(existingPlace.id, tempLocation);
      if (newData) {
        const finalData = LocationService.addNoteToPlace(existingPlace.id, noteContent.trim());
        setUserData(finalData);
        setNoteContent('');
        setSelectedPlace(null);
        setTempLocation(null);
        setRecommendation(null);
      }
    } else {
      // 如果是新地点，打开命名窗口
      setIsNamingPlace(true);
    }
  };

  const handleEditPlaceName = (placeId: string, newName: string) => {
    const newData = LocationService.editPlaceName(placeId, newName);
    setUserData(newData);
    setEditingPlace(null);
  };

  const clearData = () => {
    LocationService.clearData();
    setUserData(null);
    setError('');
    setRecommendation(null);
  };

  const openNavigation = (latitude: number, longitude: number, placeName: string) => {
    // 检测设备类型
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // 移动设备优先使用百度地图，其次高德地图，再其次腾讯地图
      const baiduUrl = `baidumap://map/direction?destination=${latitude},${longitude}&title=${encodeURIComponent(placeName)}&mode=driving`;
      const amapUrl = `androidamap://route/plan/?dlat=${latitude}&dlon=${longitude}&dname=${encodeURIComponent(placeName)}&dev=0&t=0`;
      const tencentUrl = `qqmap://map/routeplan?type=drive&to=${encodeURIComponent(placeName)}&tocoord=${latitude},${longitude}`;
      
      // 通用网页版导航，作为后备方案
      const webUrl = `https://uri.amap.com/navigation?to=${longitude},${latitude},${encodeURIComponent(placeName)}&mode=car`;
      
      // 尝试打开各种导航软件，如果都失败则打开网页版
      window.location.href = baiduUrl;
      setTimeout(() => {
        window.location.href = amapUrl;
        setTimeout(() => {
          window.location.href = tencentUrl;
          setTimeout(() => {
            window.location.href = webUrl;
          }, 2000);
        }, 2000);
      }, 2000);
    } else {
      // PC设备直接打开高德地图网页版
      window.open(`https://uri.amap.com/navigation?to=${longitude},${latitude},${encodeURIComponent(placeName)}&mode=car`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      {/* 数据展示面板 */}
      <div
        className={`fixed inset-y-0 right-0 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          isDataPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">已保存的数据</h2>
            <button
              onClick={() => setIsDataPanelOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {userData?.places.map((place: Place) => (
              <div key={place.id} className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{place.name}</div>
                <div className="mt-2">
                  {place.notes.map((note: Note) => (
                    <div key={note.id} className="mt-1 text-sm">
                      <div className="text-gray-700">{note.content}</div>
                      <div className="text-gray-400 text-xs">
                        {new Date(note.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 打开数据面板的按钮 */}
      <button
        onClick={() => setIsDataPanelOpen(true)}
        className={`fixed right-4 top-1/2 transform -translate-y-1/2 bg-white shadow-lg p-2 rounded-l-lg
          ${isDataPanelOpen ? 'hidden' : 'block'}`}
      >
        <FiChevronRight className="w-6 h-6" />
      </button>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-bold text-center mb-8">备注记录器</h2>
                  {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <span className="block sm:inline">{error}</span>
                    {error.includes('允许') && (
                      <div className="mt-2 text-sm">
                        <p className="font-semibold">如何允许位置访问：</p>
                        <ul className="list-disc ml-4 mt-1">
                          <li>Chrome/Edge: 点击地址栏左侧的锁定图标，检查位置权限设置</li>
                          <li>iOS Safari: 设置 → Safari → 位置服务</li>
                          <li>Android: 设置 → 隐私 → 位置信息</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}{recommendation && (
                  <div className="bg-blue-50 p-4 rounded-lg mb-4 relative">
                    <button
                      onClick={() => setRecommendation(null)}
                      className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    >
                      <FiX size={16} />
                    </button>                    <h3 className="font-semibold text-blue-800">来自 {recommendation.placeName} 的推荐：</h3>
                    <p className="mt-2 text-gray-600">{recommendation.note}</p>
                    <div className="text-xs text-gray-400 mt-1 space-y-1">
                      <p>上次推荐：{new Date(recommendation.timestamp).toLocaleString()}</p>                      <p>距离上次推荐：{Math.round((Date.now() - recommendation.timestamp) / (1000 * 60 * 60))} 小时</p>
                      <p>距离当前位置：{Math.round(recommendation.distance)} 米</p>
                    </div>
                    <button
                      onClick={() => openNavigation(recommendation.latitude, recommendation.longitude, recommendation.placeName)}
                      className="mt-3 bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded-full flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      导航到这里
                    </button>
                  </div>
                )}                <div className="flex flex-col space-y-4">
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={addCurrentLocationWithNote}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                      <FiMessageSquare className="mr-2" />
                      记录备注
                    </button>
                    <button
                      onClick={getRecommendation}
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                      <FiCompass className="mr-2" />
                      获取推荐
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsDataPanelOpen(true)}
                      className="bg-blue-400 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                      <FiList className="mr-2" />
                      查看历史
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={clearData}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center"
                    >
                      <FiTrash2 className="mr-1" />
                      清除所有数据
                    </button>
                  </div>
                </div>{/* 新地点命名弹窗 */}
                {isNamingPlace && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                    <div className="relative bg-white p-6 rounded-lg">
                      <form onSubmit={handleCreatePlaceWithNote} className="space-y-4">
                        <h3 className="text-lg font-semibold">发现新地点</h3>
                        <p className="text-sm text-gray-600">这是一个新地点，请为它命名</p>
                        <input
                          type="text"
                          value={newPlaceName}
                          onChange={(e) => setNewPlaceName(e.target.value)}
                          placeholder="输入地点名称..."
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNamingPlace(false);
                              setTempLocation(null);
                              setNoteContent('');
                              setNewPlaceName('');
                            }}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
                            disabled={!newPlaceName.trim()}
                          >
                            保存
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                
                {/* 添加备注弹窗 */}
                {selectedPlace === 'temp' && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                    <div className="relative bg-white p-6 rounded-lg">
                      <form onSubmit={handleAddNote} className="space-y-4">
                        <h3 className="text-lg font-semibold">添加备注</h3>
                        <input
                          type="text"
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="写点什么..."
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlace(null);
                              setTempLocation(null);
                              setNoteContent('');
                            }}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
                          >
                            保存
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* 地点列表 */}
                {userData && userData.places.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-4">已记录的地点</h3>
                    <div className="space-y-6">
                      {userData.places.map((place: Place) => (
                        <div key={place.id} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {editingPlace === place.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    defaultValue={place.name}
                                    onBlur={(e) => handleEditPlaceName(place.id, e.target.value)}
                                    className="px-2 py-1 border rounded"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => setEditingPlace(null)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <FiX />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h4 className="text-lg font-semibold">{place.name}</h4>
                                  <button
                                    onClick={() => setEditingPlace(place.id)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <FiEdit2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 备注列表 */}
                          {place.notes && place.notes.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {place.notes.map((note: Note) => (
                                <div key={note.id} className="bg-blue-50 p-2 rounded text-sm">
                                  <p className="text-gray-600">{note.content}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(note.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
