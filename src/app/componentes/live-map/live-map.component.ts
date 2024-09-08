import { Component, ElementRef, ViewChild, HostListener, OnInit, NgZone, Input } from '@angular/core';
import {MatCheckboxModule} from '@angular/material/checkbox';
import { CommonModule } from '@angular/common';
import { PerspectiveCamera, Scene, WebGLRenderer, SphereGeometry, MeshBasicMaterial, Mesh, LineLoop, BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from 'three';
import { Vehicle, Path, Time, FollowPathBehavior, OnPathBehavior, EntityManager, Vector3 } from 'yuka';
import { MapPoints } from './vectors';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Player } from '../../interface/Player';
import { Carrera } from '../../interface/Carrera';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [MatCheckboxModule, CommonModule],
  template: `
    <div class="card">
      <h4 class="card-title p-4">Live Map</h4>
      <div class="row">
        <div class="col-12 d-flex mapContainer align-items-center">
          <div #mapContainer class="mapThreejs">
        </div>
      </div>
      </div>
      <div class="card-body">
        <h1>....</h1>
      </div>
    </div>
  `,
  styleUrl: './live-map.component.css'
})

export class LiveMapComponent implements OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @Input() player1Color: number = 0xf315c3
  @Input() player2Color: number = 0xff914d

  // Primero, crea la geometría del círculo
  radius: number = 0.5; // Radio de la esfera, ajusta según sea necesario
  widthSegments: number = 12; // Segmentos horizontales
  heightSegments: number = 12; // Segmentos verticales

  hasCompletedLap: boolean = false;
  initialWaypoint!: Vector3;
  currentWaypoint!: Vector3;
  lapCount: number = 0; 
  maxLaps: number = 2; 
  lastLapTime: number = 0; 
  lapCooldown: number = 2000; //Cooldown en milisegundos (2)   

  scaleFactor: number = 0.03;
  offseX: number = 0;

  scene!: Scene;
  staticScene!: Scene
  camera!: PerspectiveCamera;
  time!: Time;  
  width!: number;
  height!: number;
  renderer!: any;  
  path!: Path;
  path2!: Path;  
  controls!: OrbitControls;

  player1!: Player
  player2!: Player 
  carrera!: Carrera

  followPathBehavior!: FollowPathBehavior;
  onPathBehavior!: OnPathBehavior;
  entityManager!: EntityManager;
  
  constructor(private zone: NgZone){}

  ngOnInit(): void {
    this.scene = new Scene();
    this.time = new Time(); 
    this.path = new Path();

    this.initialWaypoint = new Vector3();
    this.currentWaypoint = new Vector3();
    
    //New Path
    MapPoints.forEach((point: any) => {
      this.path.add(new Vector3((point[0] * this.scaleFactor) - this.offseX, 0, point[1] * this.scaleFactor))
    })
    this.path.loop = true;

    this.path2 = new Path()
    MapPoints.forEach((point: any) => {
      this.path2.add(new Vector3((point[0] * this.scaleFactor) - this.offseX, 0, point[1] * this.scaleFactor))
    })
    this.path2.loop = true;
  }


  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.updateDimensions();
      
      // Solo se ejecuta en el navegador
      this.renderer = new WebGLRenderer({ antialias: true });
      this.renderer.setSize(this.width, this.height);
      this.mapContainer.nativeElement.appendChild(this.renderer.domElement)
      this.renderer.setClearColor(0xffffff)

      this.camera = new PerspectiveCamera(75, 1, 0.1, 1000); // Inicializa con un aspect ratio por defecto
      this.camera.position.set(0, 20, 0);
      this.camera.aspect = this.width / this.height;

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true; // Para suavizar el movimiento
      this.controls.dampingFactor = 0.05;
      // Restringir la rotación en el eje vertical
      this.controls.minPolarAngle = 0; // Mínimo ángulo polar
      this.controls.maxPolarAngle = Math.PI / 2.5; // Máximo ángulo polar
    
      
  
      //Camera Position
      const gimbalPositionX = MapPoints[MapPoints.length/4][0] * this.scaleFactor
      const gimbalPositionY = MapPoints[MapPoints.length/4][1] * this.scaleFactor
      this.camera.lookAt(gimbalPositionX, 0, gimbalPositionY);
      this.controls.target.set(gimbalPositionX, 0, gimbalPositionY)
      this.controls.update();
      
      // Waypoints to render
      const position: any = [];
      MapPoints.forEach((waypoint: any) => {
        position.push(waypoint[0] * this.scaleFactor, 0, waypoint[1] * this.scaleFactor) 
      })
      const lineGeometry = new BufferGeometry();
      lineGeometry.setAttribute('position', new Float32BufferAttribute(position, 3));

      const lineMaterial = new LineBasicMaterial({color: 0x000000});
      const lines = new LineLoop(lineGeometry, lineMaterial);

      this.player1 = new Player
        (
          this.initialWaypoint, 
          this.player1Color, 
          this.radius, 
          this.widthSegments, 
          this.heightSegments, 
          2, 
          this.path
        )
        
      this.player2 = new Player
        (
          this.initialWaypoint, 
          this.player2Color, 
          this.radius, 
          this.widthSegments, 
          this.heightSegments, 
          1, 
          this.path2
        )

      this.carrera = new Carrera([this.player1, this.player2]) 

      this.scene.add(this.player1.vehicleMesh);
      this.scene.add(this.player2.vehicleMesh)
      this.scene.add(lines);

      // this.renderer.setAnimationLoop(this.animate())
      this.zone.runOutsideAngular(() => {
        this.renderer.setAnimationLoop(() => this.animate());      
      })
      }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?: Event) {
    if (typeof window !== "undefined") {
      this.updateDimensions();
      this.camera.aspect = this.width / this.height;
      this.renderer.setSize(this.width, this.height);
      this.camera.updateProjectionMatrix();
      console.log(this.width, this.height);
    }
  }


  private sync(entity: any, renderComponent: any){
    renderComponent.matrix.copy(entity.worldMatrix)
  }


  private updateDimensions(): void {
    this.width = this.mapContainer.nativeElement.clientWidth;
    this.height = this.mapContainer.nativeElement.clientHeight;
  }

  // Animate 
  private animate(): void {
    const delta = this.time.update().getDelta();

    // Stop the app if lapCount > maxLaps
    for(let player of this.carrera.corredores){
      if(player.lapCount < this.maxLaps){
        player.checkLapCount()
        player.entityManager.update(delta)
      }
    }
    
    this.hasCompletedLap = this.checkCurrentPosition()
    // this.stopAnimation()
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }


  private checkCurrentPosition(): boolean {
    const currentTime = performance.now()

    this.currentWaypoint = this.player1.vehicleAgent.getWorldPosition(this.currentWaypoint);
    const distance = this.currentWaypoint.distanceTo(this.initialWaypoint);
    const thereshold = 0.39

    if (distance < thereshold && currentTime - this.lastLapTime > this.lapCooldown) {
      this.lapCount += 1; 
      this.lastLapTime = currentTime; 
      return true
    } 
    else {
      return false
    } 
  }


  // private stopAnimation(): void{
  //   this.renderer.setAnimationLoop(null)
  // }

}
