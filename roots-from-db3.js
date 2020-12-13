// построение автобусных маршрутов с секциями остановок Москвы из PostGres базы
const all_roots = "all_roots2.json"; // 
let view_name = "routes_view_moscow";

const { Client } = require('pg');
const R = require('ramda');
const haversine = require('haversine');
let fs = require('fs');
let coord;
let id_roots;

let obj_geojson_common = { // шапка общего geo_json файла
    "name": "NewFeatureType",
    "type": "FeatureCollection",
    "features": []
};

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'local_json',
    password: 'admin',
    port: 5432
})

client.connect()
    // чтение списка маршрутов для расчета
client.query('SELECT route_id FROM ' + view_name + ' GROUP BY route_id ORDER BY route_id').then(res => {
    id_roots = res.rows; // массив всех автобусных маршрутов Москвы

}).finally(() => {

    let all_record = new Promise(async function(resolve, reject) {
        // основной цикл по маршрутам
        for (let i = 0; i < id_roots.length; i++) {
            //  for (let i = 0; i < 5; i++) { // для отладки
            await one_root(id_roots[i].route_id); // вызываем функцию расчета одного маршрута one_root
        }

        resolve(); // конец расчета всех маршрутов

    });

    all_record.then(() => {
        const obj_itog = JSON.stringify(obj_geojson_common);
        // пишем итоговый файл всех маршрутов
        fs.writeFile(all_roots, obj_itog, function(err) {
            if (err) return console.log(err);
        });
        client.end()
        console.log("Итоговый файл сформирован " + all_roots);
    });


    //  функция расчета одного маршрута
    async function one_root(id_route) {
        return new Promise(function(resolve, reject) {
            let json = { // тело geo_json файла
                features: []
            };
            // все данные одного маршрута

            client.query('SELECT * FROM ' + view_name + ' WHERE route_id = ' + id_route).then(res => {
                const data = res.rows; // данные всего маршрута
                console.log('данные  маршрута с идентификатором ' + id_route + ' прочитаны');
                let segments = []; //массив координат сегментов маршрута
                coord = data[0].geo_data.coordinates[0]; // координаты всего маршрута
                coord1 = coord.slice(); // для отладки

                for (let j = 1; j < data.length; j++) { // сразу читаем координаты второй остановки, т.к. не нужно искать ближайшую точку маршрута для первой остановки

                    let longitude = data[j].longitude; //координаты остановки
                    let latitude = data[j].latitude;

                    between_platforms = 999999;
                    let min_index, distance;

                    const platform_coord = { // координаты остановки
                        latitude: latitude,
                        longitude: longitude
                    }

                    for (let i = 0; i < coord.length; i++) {
                        const root_point_coord = { //следующая точка маршрута
                            latitude: coord[i][1],
                            longitude: coord[i][0]
                        }

                        distance = haversine(platform_coord, root_point_coord, { unit: 'meter' })

                        if (distance < between_platforms) { // ищем блищайшую к платформе точку маршрута
                            min_index = i;
                            between_platforms = distance;
                            //  console.log(i + ' dist ' + distance + ' between_platforms ' + between_platforms)
                        }
                    }
                    let last_segment_coord = coord[min_index];
                    segments[j] = coord.splice(0, min_index - 1); // получаем сегмент и удаляем его из общего маршрута
                    //  console.log(min_index);
                    segments[j].push(last_segment_coord);
                }

                let seg = [];
                let seg_for_kepler = [];

                // создаем пары координат

                for (let i = 1; i < segments.length; i++) {
                    //   console.log("segments.length   " + i + " i " + segments.length);
                    for (let j = 0; j < segments[i].length - 1; j++) {
                        //   console.log(segments[i][j][0]);
                        //  console.log(segments[i][j][1]);
                        //   console.log("segments[i].length   " + segments[i].length);
                        seg.push(
                            [
                                [segments[i][j][0], segments[i][j][1]],
                                [segments[i][j + 1][0], segments[i][j + 1][1]]
                            ]);
                    }
                    seg_for_kepler.push(seg.slice());
                    seg = []; // обнуляем сегмент одной остановки
                }

                for (let j = 0; j < data.length; j++) {

                    let obj_geo_next = {
                        type: "Feature",

                        properties: {
                            root_id: null,
                            root_name: null,
                            platform: null,
                            longitude: null,
                            latitude: null,
                            platform_number: null,
                            platform_id: null,
                            Distance: null
                        },
                        geometry: {
                            type: "MultiLineString",
                            coordinates: []
                        }
                    };

                    obj_geo_next.properties.root_name = data[j].route_name;
                    obj_geo_next.properties.platform = data[j].station_name;

                    obj_geo_next.properties.platform_number = data[j].seq_no;
                    obj_geo_next.properties.longitude = data[j].longitude;
                    obj_geo_next.properties.latitude = data[j].latitude;
                    obj_geo_next.properties.root_id = id_route;
                    obj_geo_next.properties.platform_id = data[j].station_id;

                    obj_geo_next.geometry.coordinates = seg_for_kepler[j];
                    json.features.push(obj_geo_next);

                    res_file_name = data[j].route_number;
                }

            }).finally(() => {
                // obj_geojson_forward.coord1 = coord1; // для отладки

                for (const value of json.features) { // копирование features в общий файл
                    obj_geojson_common.features.push(value);
                }
                console.log('количество остановок ' + obj_geojson_common.features.length);
                resolve(); // конец расчета одного маршрута
            });
        });
    }

});