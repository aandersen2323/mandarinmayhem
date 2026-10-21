import * as THREE from 'three';
import { CharacterAvatarConfig } from '../types/game';

export interface ArticulatedAvatar {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  headGroup: THREE.Group;
  thrusterLightL?: THREE.PointLight;
  thrusterLightR?: THREE.PointLight;
  flameMeshL?: THREE.Mesh;
  flameMeshR?: THREE.Mesh;
}

export function buildCustomAvatarMesh(
  config: CharacterAvatarConfig,
  scale: number = 1.0
): ArticulatedAvatar {
  const root = new THREE.Group();
  root.scale.set(scale, scale, scale);

  const primaryHex = parseInt(config.primaryColor.replace('#', '0x')) || 0x06b6d4;
  const secondaryHex = parseInt(config.secondaryColor.replace('#', '0x')) || 0x1e293b;
  const glowHex = parseInt(config.glowColor.replace('#', '0x')) || 0x10b981;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    metalness: 0.7,
    roughness: 0.3,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: secondaryHex,
    metalness: 0.85,
    roughness: 0.25,
  });

  const glowMat = new THREE.MeshStandardMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: 0.9,
    roughness: 0.1,
  });

  const skinToneMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.6,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
  });

  // Torso / Core
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.6;
  root.add(torsoGroup);

  // Chest armor based on armorId
  if (config.armorId === 'heavy_mecha_plate') {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.75), secondaryMat);
    chest.castShadow = true;
    torsoGroup.add(chest);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.2), primaryMat);
    plate.position.set(0, 0.1, 0.35);
    torsoGroup.add(plate);
  } else if (config.armorId === 'cyber_hanfu' || config.armorId === 'dragonslayer_robe') {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.35, 0.6), primaryMat);
    chest.castShadow = true;
    torsoGroup.add(chest);

    // Flowing sash / robe collar
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.9, 8), secondaryMat);
    sash.position.set(0, -0.2, 0);
    torsoGroup.add(sash);
  } else {
    // Stealth Nanosuit / Streetwear
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.55), primaryMat);
    chest.castShadow = true;
    torsoGroup.add(chest);
  }

  // Glowing Qi Core Reactor
  const arcCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), glowMat);
  arcCore.rotateX(Math.PI / 2);
  arcCore.position.set(0, 0.15, 0.3);
  torsoGroup.add(arcCore);

  // Pauldrons (Shoulders)
  const pauldronGeo = config.armorId === 'heavy_mecha_plate'
    ? new THREE.BoxGeometry(0.45, 0.35, 0.55)
    : new THREE.BoxGeometry(0.35, 0.25, 0.45);

  const pauldronL = new THREE.Mesh(pauldronGeo, secondaryMat);
  pauldronL.position.set(-0.62, 0.52, 0);
  torsoGroup.add(pauldronL);

  const pauldronR = new THREE.Mesh(pauldronGeo, secondaryMat);
  pauldronR.position.set(0.62, 0.52, 0);
  torsoGroup.add(pauldronR);

  // BACK ITEM
  if (config.backItemId === 'cyber_katana') {
    const katanaGroup = new THREE.Group();
    katanaGroup.position.set(0, 0.2, -0.32);

    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), glowMat);
    blade1.rotation.z = Math.PI / 4;
    blade1.position.set(-0.2, 0.2, 0);
    katanaGroup.add(blade1);

    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), glowMat);
    blade2.rotation.z = -Math.PI / 4;
    blade2.position.set(0.2, 0.2, 0);
    katanaGroup.add(blade2);

    torsoGroup.add(katanaGroup);
  } else if (config.backItemId === 'plasma_wings') {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0, 0.3, -0.35);

    const wingGeo = new THREE.BufferGeometry();
    const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.3, 4), glowMat);
    wingL.rotation.z = Math.PI / 3;
    wingL.rotation.y = 0.2;
    wingL.position.set(-0.7, 0.3, -0.1);
    wingGroup.add(wingL);

    const wingR = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.3, 4), glowMat);
    wingR.rotation.z = -Math.PI / 3;
    wingR.rotation.y = -0.2;
    wingR.position.set(0.7, 0.3, -0.1);
    wingGroup.add(wingR);

    torsoGroup.add(wingGroup);
  } else if (config.backItemId === 'qi_scroll') {
    const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 16), goldTrimMat);
    scroll.rotation.z = Math.PI / 3;
    scroll.position.set(0, 0.25, -0.35);
    torsoGroup.add(scroll);
  } else if (config.backItemId === 'energy_blades') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.07, 12, 32), glowMat);
    ring.position.set(0, 0.3, -0.4);
    torsoGroup.add(ring);
  } else if (config.backItemId === 'quantum_backpack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), secondaryMat);
    pack.position.set(0, 0.1, -0.36);
    torsoGroup.add(pack);
  }

  // Dual Jump Jetpack Thrusters
  const jetpackBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.22), secondaryMat);
  jetpackBody.position.set(0, 0.1, -0.36);
  torsoGroup.add(jetpackBody);

  const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 12), secondaryMat);
  thrusterL.position.set(-0.24, -0.25, -0.36);
  torsoGroup.add(thrusterL);

  const thrusterR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 12), secondaryMat);
  thrusterR.position.set(0.24, -0.25, -0.36);
  torsoGroup.add(thrusterR);

  // Flame cones for jump thrusters
  const flameGeo = new THREE.ConeGeometry(0.14, 0.45, 8);
  flameGeo.rotateX(Math.PI);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.24, -0.48, -0.36);
  flameL.visible = false;
  torsoGroup.add(flameL);

  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.24, -0.48, -0.36);
  flameR.visible = false;
  torsoGroup.add(flameR);

  // HEAD GROUP
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.95, 0);
  torsoGroup.add(headGroup);

  // Base Head / Face
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.58), skinToneMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // HUD Visor on Face
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.15), glowMat);
  visorMesh.position.set(0, 0.05, 0.28);
  headGroup.add(visorMesh);

  // HAIRSTYLE / HELMET
  if (config.hairstyleId === 'spiky_cyber') {
    const spikeGeo = new THREE.ConeGeometry(0.12, 0.38, 5);
    spikeGeo.rotateX(-Math.PI / 2);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(spikeGeo, glowMat);
      spike.position.set(i * 0.16, 0.36, -0.05);
      spike.rotation.x = -0.3;
      headGroup.add(spike);
    }
  } else if (config.hairstyleId === 'samurai_topknot') {
    const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.35, 8), secondaryMat);
    knot.position.set(0, 0.45, -0.1);
    headGroup.add(knot);
  } else if (config.hairstyleId === 'tech_visor_helm') {
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.65, 0.65), secondaryMat);
    headGroup.add(helm);
    const fullVisor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.15), glowMat);
    fullVisor.position.set(0, 0.05, 0.32);
    headGroup.add(fullVisor);
  } else if (config.hairstyleId === 'dragon_horns') {
    const hornGeo = new THREE.ConeGeometry(0.1, 0.45, 6);
    const hornL = new THREE.Mesh(hornGeo, goldTrimMat);
    hornL.position.set(-0.25, 0.45, 0.05);
    hornL.rotation.z = 0.4;
    headGroup.add(hornL);

    const hornR = new THREE.Mesh(hornGeo, goldTrimMat);
    hornR.position.set(0.25, 0.45, 0.05);
    hornR.rotation.z = -0.4;
    headGroup.add(hornR);
  } else {
    // Neon fade
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.6), primaryMat);
    hair.position.set(0, 0.35, 0);
    headGroup.add(hair);
  }

  // HATS & HEADWEAR
  if (config.hatId === 'bamboo_conical') {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.32, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
    );
    hat.position.set(0, 0.48, 0);
    headGroup.add(hat);
  } else if (config.hatId === 'phoenix_crown') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.2, 8), goldTrimMat);
    crown.position.set(0, 0.45, 0);
    headGroup.add(crown);

    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), glowMat);
    plume.position.set(0, 0.7, 0);
    headGroup.add(plume);
  } else if (config.hatId === 'golden_headband') {
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 24), goldTrimMat);
    headband.rotation.x = Math.PI / 2;
    headband.position.set(0, 0.15, 0);
    headGroup.add(headband);
  } else if (config.hatId === 'tactical_beret') {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.35, 0.12, 12), secondaryMat);
    beret.position.set(0.05, 0.4, 0);
    beret.rotation.z = -0.2;
    headGroup.add(beret);
  }

  // ARMS (Left & Right)
  const armGeo = new THREE.BoxGeometry(0.28, 0.95, 0.28);
  armGeo.translate(0, -0.42, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.65, 0.4, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, primaryMat);
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  torsoGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.65, 0.4, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, primaryMat);
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  torsoGroup.add(rightArm);

  // LEGS (Left & Right)
  const legGeo = new THREE.BoxGeometry(0.35, 1.05, 0.35);
  legGeo.translate(0, -0.5, 0);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.25, 1.05, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, secondaryMat);
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  // Boot trim
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.45), primaryMat);
  bootL.position.set(0, -0.9, 0.05);
  leftLeg.add(bootL);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.25, 1.05, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, secondaryMat);
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.45), primaryMat);
  bootR.position.set(0, -0.9, 0.05);
  rightLeg.add(bootR);
  root.add(rightLeg);

  return {
    group: root,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    flameMeshL: flameL,
    flameMeshR: flameR,
  };
}
