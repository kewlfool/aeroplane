class Particle {
  constructor(x = random(width), y = random(height)) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.vel.setMag(random(2, 4));
    this.acc = createVector(0, 0);
    this.maxSpeed = 3;
    this.h = 0;
    this.maxForce = 0.2;
    this.r = random(3, 5);
    // this.r = 3;
    this.delay = 0;
    this.tail = this.r * 2;

    this.currentPath = [];
    this.paths = [this.currentPath];

    this.wanderTheta = PI / 2;
    this.xoff = 0;

    this.color = random([
      "#75D9B7",
      "#FD9A9A",
      "#8DBDF0",
      "#F9D472",
      "#BC83F9",
      "#FDA5C6",
      "#80F9D9",
      "#00A4FF",
      "#FBE4E4",
      "#EFFB91",
      "#FFFFFF",
    ]);

    //noise loops
    // this.xNoise = new NoiseLoop(0.5, -width, width * 2);
    // this.yNoise = new NoiseLoop(0.5, -height, height * 2);
    // this.dNoise = new NoiseLoop(7, 10, 120);
    // this.rNoise = new NoiseLoop(7, 100, 255);
    // this.bNoise = new NoiseLoop(7, 100, 255);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  wander() {
    let wanderPoint = this.vel.copy();
    wanderPoint.setMag(10);
    wanderPoint.add(this.pos);

    let wanderRadius = 6;
    noFill();
    // stroke(255);
    // circle(wanderPoint.x, wanderPoint.y, 5);
    // line(this.pos.x, this.pos.y, wanderPoint.x, wanderPoint.y);

    let theta = this.wanderTheta + this.vel.heading();

    let x = wanderRadius * cos(theta);
    let y = wanderRadius * sin(theta);
    wanderPoint.add(x, y);
    // fill(0, 255, 0);
    // noStroke();
    // circle(wanderPoint.x, wanderPoint.y, 16);

    // stroke(255);
    // line(this.pos.x, this.pos.y, wanderPoint.x, wanderPoint.y);

    let steer = wanderPoint.sub(this.pos);
    steer.setMag(this.maxForce);
    this.applyForce(steer);

    let displaceRange = 0.3;
    this.wanderTheta += random(-displaceRange, displaceRange);
  }

  wanderNoise() {
    let angle = noise(this.xoff) * TWO_PI * 2;
    let steer = p5.Vector.fromAngle(angle);

    steer.setMag(this.maxForce);
    this.applyForce(steer);

    this.xoff += 0.02;
  }

  pursue(target) {
    let target2 = target.pos.copy();
    let prediction = target.vel.copy();

    prediction.mult(10);
    target2.add(prediction);
    fill(0, 255, 0);
    // circle(target2.pos.x, target2.pos.y, 16);
    return this.seek(target2);
  }

  arrive(target) {
    // 2nd argument true enables the arrival behavior
    let target2 = target.pos.copy();
    return this.seek(target2, true);
  }

  seek(target, arrival = false) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      let slowRadius = 100;
      let distance = force.mag();
      if (distance < slowRadius) {
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }
    force.setMag(desiredSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  flee(target) {
    // let target2 = target.pos.copy();
    return this.seek(target).mult(-1);
  }

  evade(target) {
    let pursuit = this.pursue(target);
    pursuit.mult(-1);
    return pursuit;
  }

  applyForce(force) {
    this.acc.add(force);
  }
  // console.log(force.add());
  follow(vectors) {
    var x = floor(this.pos.x / scl);
    var y = floor(this.pos.y / scl);
    x = constrain(x, 0, cols - 1);
    y = constrain(y, 0, rows - 1);
    var index = x + y * cols;

    if (index >= 0 && index < vectors.length) {
      var force = vectors[index];
      force.mult(forceSlider.value()); // Scale the force
      this.applyForce(force); // Apply the scaled force
    } else {
      console.error("Index out of bounds:", index);
    }
    // force.mult(forceSlider.value());
    // this.applyForce(force);
  }

  // noise loop render function
  render(percent) {
    noStroke();
    let x = this.xNoise.value(a);
    let y = this.yNoise.value(a);
    let d = this.dNoise.value(a);
    let r = this.rNoise.value(a);
    let b = this.bNoise.value(a);
    fill(r, 50, b, 200);
    ellipse(x, y, d);
  }

  trail() {
    this.currentPath.push(this.pos.copy());
    // Count positions
    let total = 0;
    for (let path of this.paths) {
      total += path.length;
    }

    // total > 5000 || (total > 10 && millis() > 3000)
    if (total > this.tail) {
      this.paths[0].shift();
      if (this.paths[0].length === 0) {
        this.paths.shift();
      }
    }

    for (let path of this.paths) {
      beginShape();
      push();

      stroke(this.color);
      noFill();
      // strokeWeight(this.r * 0.2);
      strokeWeight(this.r * 0.4);
      for (let v of path) {
        vertex(v.x, v.y);
      }
      endShape();
      pop();
    }
  }

  edgesBounce() {
    if (this.pos.y >= height - this.r) {
      this.pos.y = height - this.r;
      this.vel.y *= -1;
    }

    if (this.pos.x >= width - this.r) {
      this.pos.x = width - this.r;
      this.vel.x *= -1;
    }

    if (this.pos.y <= this.r) {
      this.pos.y = this.r;
      this.vel.y *= -1;
    } else if (this.pos.x <= this.r) {
      this.pos.x = this.r;
      this.vel.x *= -1;
    }
  }

  edges() {
    let hitEdge = false;
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
      hitEdge = true;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
      hitEdge = true;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
      hitEdge = true;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
      hitEdge = true;
    }

    if (hitEdge) {
      this.currentPath = [];
      this.paths.push(this.currentPath);
    }
  }
  edgeN() {
    let hitEdge = false;
    if (
      this.pos.x > width ||
      this.pos.x < 0 ||
      this.pos.y > height ||
      this.pos.y < 0
    ) {
      this.pos.x = random(width);
      this.pos.y = random(height);
      hitEdge = true;
    }

    if (hitEdge) {
      this.currentPath = [];
      this.paths.push(this.currentPath);
    }
  }

  show() {
    push();

    stroke(222, this.h);
    this.h = this.h + 1;
    if (this.h > 255) {
      this.h = 0;
    }

    stroke(this.color);
    // stroke(13);
    strokeWeight(this.r * 0.5);
    // strokeWeight(1);

    point(this.pos.x, this.pos.y);

    pop();
  }

  flock(qtree) {
    let alignment = this.align(qtree);
    let cohesion = this.cohesion(qtree);
    let separation = this.separation(qtree);

    alignment.mult(alignSlider.value());
    cohesion.mult(cohesionSlider.value());
    separation.mult(separationSlider.value());

    this.acc.add(alignment);
    this.acc.add(cohesion);
    this.acc.add(separation);
  }

  align(qtree) {
    let perceptionRadius = 25;
    let steering = createVector();
    let total = 0;

    // Create a range object for querying
    let range = new Rectangle(
      this.pos.x,
      this.pos.y,
      perceptionRadius * 2,
      perceptionRadius * 2
    );

    // Get potential neighbors from quadtree
    let others = qtree.query(range);

    for (let p of others) {
      let other = p.userData;
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (other != this && d < perceptionRadius) {
        steering.add(other.vel);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.vel);
      steering.limit(this.maxForce);
    }
    return steering;
  }
  cohesion(qtree) {
    let perceptionRadius = 50;
    let steering = createVector();
    let total = 0;

    // Create a range object for querying
    let range = new Rectangle(
      this.pos.x,
      this.pos.y,
      perceptionRadius * 2,
      perceptionRadius * 2
    );

    // Get potential neighbors from quadtree
    let others = qtree.query(range);

    for (let p of others) {
      let other = p.userData;

      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (other != this && d < perceptionRadius) {
        steering.add(other.pos);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.sub(this.pos);
      steering.setMag(this.maxSpeed);
      steering.sub(this.vel);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  separation(qtree) {
    let perceptionRadius = 25;
    let steering = createVector();
    let total = 0;

    // Create a range object for querying
    let range = new Rectangle(
      this.pos.x,
      this.pos.y,
      perceptionRadius * 2,
      perceptionRadius * 2
    );

    // Get potential neighbors from quadtree
    let others = qtree.query(range);

    for (let p of others) {
      let other = p.userData;
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (other != this && d < perceptionRadius) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.vel);
      steering.limit(this.maxForce);
    }
    return steering;
  }
}
